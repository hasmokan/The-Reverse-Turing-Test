'use strict';

/**
 * Cocos Creator 构建扩展 — 自动处理 RemoteUI 资源的构建优化
 *
 * 构建前（onBeforeBuild）：
 *   - 动态扫描 assets/RemoteUI/*.png.meta 获取全部 RemoteUI UUID
 *   - 备份场景文件
 *   - 移除场景中对 RemoteUI 图片的直接引用（匹配任意属性名），防止被打包到 main bundle
 *
 * 构建后（onAfterBuild）：
 *   - 恢复场景文件
 *   - 清理 RemoteUI/native/ 目录（运行时通过 COS 远程加载，无需本地保留）
 *   - 在 main/native/ 中为 RemoteUI 资源创建 1×1 透明 PNG 占位符，
 *     防止因 config.json 残留引用导致的 "file does not exist" 运行时错误
 *     （占位图在运行时会被 ResourceLoader 从 COS 加载的正确纹理替换）
 *
 * 参考: https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-build-plugin
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PACKAGE_NAME = 'remote-bundle-cleaner';
const HOOK_VERSION = '2026-02-21-fix4930-v2';
const REMOTE_BUNDLES = ['RemoteUI'];
// 可选策略：
// - local-safe：稳定优先，不修改场景引用、不清理 native、不生成占位图
// - remote-placeholder（默认）：远程包体优化策略（移除引用 + 清理 + 占位图）
const BUILD_STRATEGY = 'remote-placeholder';

// 需要处理的场景文件（相对于项目根目录）
const SCENE_FILES = [
    'assets/scenes/MainScene.scene',
    'assets/scenes/MultiPlayerScene.scene',
];

// SpriteFrame sub-asset 后缀
const SPRITE_FRAME_SUFFIX = '@f9941';

// 1×1 透明 RGBA PNG（兜底占位图）
const DEFAULT_PLACEHOLDER_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=',
    'base64'
);

// 透明 PNG 缓存（key: "widthxheight"）
const PLACEHOLDER_CACHE = new Map();

// CRC32 查表缓存（PNG chunk 需要）
let CRC32_TABLE = null;

// UUID 解码常量（匹配 Cocos Creator 引擎 decode-uuid.ts 的算法）
const BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const BASE64_VALUES = new Array(128).fill(64);
for (let i = 0; i < 64; i++) {
    BASE64_VALUES[BASE64_KEYS.charCodeAt(i)] = i;
}
const HEX_CHARS = '0123456789abcdef';
// UUID 模板中非 '-' 的位置索引（8, 13, 18, 23 是连字符位置）
const UUID_HEX_INDICES = [
    0, 1, 2, 3, 4, 5, 6, 7,
    9, 10, 11, 12,
    14, 15, 16, 17,
    19, 20, 21, 22,
    24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
];

exports.throwError = true;

exports.load = async function () {
    console.log(PACKAGE_NAME, `builder hooks loaded [${HOOK_VERSION}] from ${__filename}`);
};

exports.unload = async function () {
    console.log(PACKAGE_NAME, 'builder hooks unloaded');
};

// ============================
// 工具函数
// ============================

function getProjectRoot(options) {
    // options.project 是项目根目录（Cocos Creator 传入）
    // 回退路径: dist/ → remote-bundle-cleaner/ → extensions/ → 项目根目录（3级）
    return options.project || path.resolve(__dirname, '../../..');
}

function getBackupPath(scenePath) {
    return scenePath + '.build-bak';
}

function writeFileAtomic(filePath, buffer) {
    const dir = path.dirname(filePath);
    const tmpPath = path.join(
        dir,
        `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, filePath);
}

function isValidPngBuffer(buffer) {
    if (!buffer || buffer.length < 33) return false;
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!buffer.subarray(0, 8).equals(signature)) return false;

    let offset = 8;
    let seenIend = false;

    while (offset + 12 <= buffer.length) {
        const dataLength = buffer.readUInt32BE(offset);
        const typeOffset = offset + 4;
        const dataOffset = typeOffset + 4;
        const crcOffset = dataOffset + dataLength;
        const nextOffset = crcOffset + 4;

        if (nextOffset > buffer.length) return false;

        const typeBuf = buffer.subarray(typeOffset, typeOffset + 4);
        const dataBuf = buffer.subarray(dataOffset, dataOffset + dataLength);
        const expectedCrc = buffer.readUInt32BE(crcOffset);
        const actualCrc = crc32(Buffer.concat([typeBuf, dataBuf]));
        if (expectedCrc !== actualCrc) return false;

        const type = typeBuf.toString('ascii');
        offset = nextOffset;
        if (type === 'IEND') {
            seenIend = true;
            break;
        }
    }

    return seenIend;
}

function writePlaceholderWithVerification(filePath, placeholder, label) {
    writeFileAtomic(filePath, placeholder);
    const readBack = fs.readFileSync(filePath);
    if (!isValidPngBuffer(readBack)) {
        throw new Error(`占位图写入校验失败: ${label} (${filePath})`);
    }
}

function collectFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const fullPath = path.join(d, entry.name);
            if (entry.isDirectory()) walk(fullPath);
            else files.push({ path: fullPath, name: entry.name, size: fs.statSync(fullPath).size });
        }
    };
    walk(dir);
    return files;
}

/**
 * 从多种来源尝试获取构建输出目录
 */
function resolveBuildDest(options, result) {
    // 1. 优先从 result 中获取（Cocos Creator 3.8 标准方式）
    if (result && result.dest) return result.dest;

    // 2. 尝试 options 上常见属性
    if (options.dest) return options.dest;
    if (options.buildPath) return options.buildPath;

    // 3. 从 options.outputName 和 options.buildPath 拼接
    if (options.outputName) {
        const projectRoot = getProjectRoot(options);
        const candidate = path.join(projectRoot, 'build', options.outputName);
        if (fs.existsSync(candidate)) return candidate;
    }

    // 4. 终极回退：从项目根目录扫描 build/ 目录，找最新的构建产物
    const projectRoot = getProjectRoot(options);
    const buildDir = path.join(projectRoot, 'build');
    if (fs.existsSync(buildDir)) {
        const entries = fs.readdirSync(buildDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => ({
                name: e.name,
                fullPath: path.join(buildDir, e.name),
                mtime: fs.statSync(path.join(buildDir, e.name)).mtimeMs,
            }))
            .sort((a, b) => b.mtime - a.mtime);

        if (entries.length > 0) {
            console.log(PACKAGE_NAME, `[回退] 使用最新构建目录: ${entries[0].name}`);
            return entries[0].fullPath;
        }
    }

    return null;
}

/**
 * 动态扫描 assets/RemoteUI/*.png.meta，提取所有 RemoteUI 图片的 UUID
 */
function scanRemoteUIUuids(projectRoot) {
    const remoteUIDir = path.join(projectRoot, 'assets', 'RemoteUI');
    const uuids = [];

    if (!fs.existsSync(remoteUIDir)) {
        console.warn(PACKAGE_NAME, `RemoteUI 目录不存在: ${remoteUIDir}`);
        return uuids;
    }

    const metaFiles = fs.readdirSync(remoteUIDir).filter(f => f.endsWith('.png.meta'));
    for (const metaFile of metaFiles) {
        try {
            const metaPath = path.join(remoteUIDir, metaFile);
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (meta.uuid) {
                uuids.push(meta.uuid);
                console.log(PACKAGE_NAME, `  发现资源: ${metaFile.replace('.meta', '')} → ${meta.uuid}`);
            }
        } catch (e) {
            console.warn(PACKAGE_NAME, `解析 meta 失败: ${metaFile}: ${e.message}`);
        }
    }

    console.log(PACKAGE_NAME, `共扫描到 ${uuids.length} 个 RemoteUI UUID（${metaFiles.length} 个 meta 文件）`);
    return uuids;
}

/**
 * 读取 assets/RemoteUI/*.png.meta，提取每个 UUID 对应的原始尺寸
 * 用于生成尺寸匹配的透明占位图，避免 SpriteFrame rect 越界报错（Error 3300）。
 */
function collectRemoteUIPlaceholderSpecs(projectRoot) {
    const remoteUIDir = path.join(projectRoot, 'assets', 'RemoteUI');
    const specs = {};

    if (!fs.existsSync(remoteUIDir)) {
        return specs;
    }

    const metaFiles = fs.readdirSync(remoteUIDir).filter(f => f.endsWith('.png.meta'));
    for (const metaFile of metaFiles) {
        try {
            const metaPath = path.join(remoteUIDir, metaFile);
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            const uuid = meta && meta.uuid;
            const spriteUserData = meta && meta.subMetas && meta.subMetas.f9941 && meta.subMetas.f9941.userData;
            if (!uuid || !spriteUserData) continue;

            // 纹理至少要覆盖 trim 后坐标范围，否则会触发 SpriteFrame checkRect 错误。
            const trimX = Number(spriteUserData.trimX || 0);
            const trimY = Number(spriteUserData.trimY || 0);
            const width = Number(spriteUserData.width || 1);
            const height = Number(spriteUserData.height || 1);
            const rawWidth = Number(spriteUserData.rawWidth || 1);
            const rawHeight = Number(spriteUserData.rawHeight || 1);

            const finalWidth = Math.max(1, rawWidth, trimX + width);
            const finalHeight = Math.max(1, rawHeight, trimY + height);

            specs[uuid] = {
                width: finalWidth,
                height: finalHeight,
            };
        } catch (e) {
            console.warn(PACKAGE_NAME, `解析尺寸信息失败: ${metaFile}: ${e.message}`);
        }
    }

    return specs;
}

function getCrc32Table() {
    if (CRC32_TABLE) return CRC32_TABLE;
    CRC32_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        CRC32_TABLE[n] = c >>> 0;
    }
    return CRC32_TABLE;
}

function crc32(buffer) {
    const table = getCrc32Table();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buffer.length; i++) {
        crc = table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length >>> 0, 0);

    const crcInput = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput), 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * 生成指定尺寸的全透明 PNG（RGBA8, 无交错）
 */
function createTransparentPng(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return DEFAULT_PLACEHOLDER_PNG;
    }

    const key = `${width}x${height}`;
    if (PLACEHOLDER_CACHE.has(key)) {
        return PLACEHOLDER_CACHE.get(key);
    }

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width >>> 0, 0);
    ihdr.writeUInt32BE(height >>> 0, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type: RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    // 每行: 1 字节 filter + width * 4 字节 RGBA（全 0 = 全透明黑）
    const raw = Buffer.alloc((width * 4 + 1) * height, 0);
    const idat = zlib.deflateSync(raw, { level: 9 });

    const png = Buffer.concat([
        signature,
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', idat),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);

    PLACEHOLDER_CACHE.set(key, png);
    return png;
}

/**
 * 解码 Cocos Creator 压缩 UUID（22 字符 base64 → 标准 UUID 格式）
 * 算法来源: cocos/core/utils/decode-uuid.ts
 *
 * 压缩格式: 2 个保留 hex 字符 + 20 个 base64 字符 = 22 字符
 * 解码结果: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx（32 hex + 4 连字符 = 36 字符）
 */
function decodeUuid(base64) {
    const parts = base64.split('@');
    const compressed = parts[0];
    if (compressed.length !== 22) return base64;

    const result = new Array(36);
    result[8] = result[13] = result[18] = result[23] = '-';

    // 前 2 个字符直接保留
    result[UUID_HEX_INDICES[0]] = compressed[0];
    result[UUID_HEX_INDICES[1]] = compressed[1];

    // 剩余 20 个 base64 字符解码为 30 个 hex 字符
    for (let i = 2, j = 2; i < 22; i += 2) {
        const lhs = BASE64_VALUES[compressed.charCodeAt(i)];
        const rhs = BASE64_VALUES[compressed.charCodeAt(i + 1)];
        result[UUID_HEX_INDICES[j++]] = HEX_CHARS[lhs >> 2];
        result[UUID_HEX_INDICES[j++]] = HEX_CHARS[(lhs & 3) << 2 | rhs >> 4];
        result[UUID_HEX_INDICES[j++]] = HEX_CHARS[rhs & 0xF];
    }

    const decoded = result.join('');
    return parts.length > 1 ? decoded + '@' + parts.slice(1).join('@') : decoded;
}

/**
 * 备份场景文件并移除 RemoteUI 引用
 * 使用通用正则匹配任意属性名（覆盖 _spriteFrame、backgroundImage 等）
 */
function backupAndPatchScene(scenePath, remoteUuids) {
    if (!fs.existsSync(scenePath)) {
        console.log(PACKAGE_NAME, `场景不存在，跳过: ${path.basename(scenePath)}`);
        return 0;
    }

    const backupPath = getBackupPath(scenePath);

    // 如有残留备份，先恢复
    if (fs.existsSync(backupPath)) {
        console.log(PACKAGE_NAME, `发现残留备份，先恢复: ${path.basename(scenePath)}`);
        fs.copyFileSync(backupPath, scenePath);
    }

    // 备份原始场景
    fs.copyFileSync(scenePath, backupPath);
    console.log(PACKAGE_NAME, `已备份: ${path.basename(scenePath)}`);

    // 读取并移除 RemoteUI 引用
    let content = fs.readFileSync(scenePath, 'utf-8');
    let totalReplacements = 0;

    for (const uuid of remoteUuids) {
        // 匹配任意属性名引用 RemoteUI SpriteFrame 的 JSON 片段
        // 覆盖: "_spriteFrame", "backgroundImage", "_backgroundImage" 等
        const pattern = `"([^"]+)":\\s*\\{\\s*"__uuid__":\\s*"${uuid}${SPRITE_FRAME_SUFFIX}"(?:,\\s*"__expectedType__":\\s*"cc\\.SpriteFrame")?\\s*\\}`;
        const regex = new RegExp(pattern, 'g');

        let matchCount = 0;
        content = content.replace(regex, (match, propName) => {
            matchCount++;
            return `"${propName}": null`;
        });

        if (matchCount > 0) {
            totalReplacements += matchCount;
            console.log(PACKAGE_NAME, `  ${uuid.substring(0, 8)}...: ${matchCount} 处引用已移除`);
        }
    }

    if (totalReplacements > 0) {
        fs.writeFileSync(scenePath, content, 'utf-8');
        console.log(PACKAGE_NAME, `${path.basename(scenePath)}: 共移除 ${totalReplacements} 处 RemoteUI 引用`);
    } else {
        console.log(PACKAGE_NAME, `${path.basename(scenePath)}: 无需移除引用`);
    }

    return totalReplacements;
}

/**
 * 恢复场景文件
 */
function restoreScene(scenePath) {
    const backupPath = getBackupPath(scenePath);

    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, scenePath);
        fs.unlinkSync(backupPath);
        console.log(PACKAGE_NAME, `已恢复: ${path.basename(scenePath)}`);
        return true;
    }

    return false;
}

function getPlaceholderBufferForUuid(uuid, placeholderSpecs) {
    const spec = placeholderSpecs[uuid];
    if (!spec) {
        return DEFAULT_PLACEHOLDER_PNG;
    }
    return createTransparentPng(spec.width, spec.height);
}

/**
 * 在 main/native/ 中为 RemoteUI 资源创建“尺寸匹配”的透明 PNG 占位符
 *
 * 策略:
 *   Pass 1 — 扫描 main/native/ 已有文件，匹配 RemoteUI UUID 的大图替换为占位符
 *   Pass 2 — 对 Pass 1 未匹配到的 UUID，读取 config.json 获取预期路径并创建占位符
 *
 * Native 文件路径格式（来源: cocos/asset/asset-manager/url-transformer.ts#combine）:
 *   {nativeBase}/{uuid[0:2]}/{uuid}{.nativeVer}{ext}
 *   其中 uuid 为完整解码后的 UUID（含连字符）
 */
function createPlaceholders(dest, remoteUuids, placeholderSpecs) {
    const mainNativeDir = path.join(dest, 'assets', 'main', 'native');

    if (!fs.existsSync(mainNativeDir)) {
        console.log(PACKAGE_NAME, 'main/native/ 目录不存在，跳过占位符创建');
        return 0;
    }

    const foundUuids = new Set();
    let count = 0;
    let savedBytes = 0;

    // Pass 1: 扫描已有文件，替换 RemoteUI 大图为占位符
    for (const uuid of remoteUuids) {
        const prefix = uuid.substring(0, 2);
        const prefixDir = path.join(mainNativeDir, prefix);
        if (!fs.existsSync(prefixDir)) continue;

        // 查找以该 UUID 开头的文件（可能带 .hash 后缀）
        const matchingFiles = fs.readdirSync(prefixDir).filter(f => f.startsWith(uuid));
        if (matchingFiles.length > 0) {
            foundUuids.add(uuid);
            for (const file of matchingFiles) {
                const filePath = path.join(prefixDir, file);
                const oldSize = fs.statSync(filePath).size;
                const placeholder = getPlaceholderBufferForUuid(uuid, placeholderSpecs);
                if (oldSize > placeholder.length) {
                    savedBytes += oldSize - placeholder.length;
                }
                writePlaceholderWithVerification(filePath, placeholder, `${prefix}/${file}`);
                console.log(PACKAGE_NAME, `  替换: ${prefix}/${file} (${oldSize} → ${placeholder.length} bytes)`);
                count++;
            }
        }
    }

    // Pass 2: 对未找到文件的 UUID，从 config.json 获取预期路径并创建占位符
    const missingUuids = remoteUuids.filter(u => !foundUuids.has(u));
    if (missingUuids.length > 0) {
        const created = createMissingPlaceholders(dest, mainNativeDir, missingUuids, placeholderSpecs);
        count += created;
    }

    if (savedBytes > 0) {
        console.log(PACKAGE_NAME, `  占位符替换共节省: ${(savedBytes / 1024).toFixed(1)} KB`);
    }

    return count;
}

/**
 * 通过解析 config.json 为缺失的 native 文件创建占位符
 */
function createMissingPlaceholders(dest, mainNativeDir, missingUuids, placeholderSpecs) {
    const configPath = path.join(dest, 'assets', 'main', 'config.json');

    if (!fs.existsSync(configPath)) {
        console.log(PACKAGE_NAME, 'config.json 不存在，使用简单模式创建占位符');
        return createPlaceholdersSimple(mainNativeDir, missingUuids, placeholderSpecs);
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
        console.warn(PACKAGE_NAME, `解析 config.json 失败: ${e.message}`);
        return createPlaceholdersSimple(mainNativeDir, missingUuids, placeholderSpecs);
    }

    const configUuids = config.uuids || [];

    // 解码 config 中的压缩 UUID，建立 fullUuid → index 映射
    const uuidToIndex = {};
    for (let i = 0; i < configUuids.length; i++) {
        const decoded = decodeUuid(configUuids[i]);
        uuidToIndex[decoded] = i;
    }

    // 解析 versions.native: [uuid_index, hash, uuid_index, hash, ...]
    const nativeVers = {};
    const nativeEntries = (config.versions && config.versions.native) || [];
    for (let i = 0; i < nativeEntries.length; i += 2) {
        nativeVers[nativeEntries[i]] = nativeEntries[i + 1];
    }

    // 解析 extensionMap: { ".png": [uuid_index, ...], ".jpg": [...] }
    const extMap = {};
    const extensionMap = config.extensionMap || {};
    for (const ext of Object.keys(extensionMap)) {
        const indices = extensionMap[ext];
        if (Array.isArray(indices)) {
            for (const idx of indices) {
                if (typeof idx === 'number') extMap[idx] = ext;
            }
        }
    }

    let count = 0;
    for (const uuid of missingUuids) {
        const idx = uuidToIndex[uuid];
        if (idx === undefined) {
            // UUID 不在 config 中 → 场景补丁生效，构建未包含此资源，无需占位符
            console.log(PACKAGE_NAME, `  补丁生效，无需占位: ${uuid.substring(0, 8)}...`);
            continue;
        }

        const ver = nativeVers[idx] !== undefined ? '.' + nativeVers[idx] : '';
        const ext = extMap[idx] || '.png';
        const prefix = uuid.substring(0, 2);
        const fileName = uuid + ver + ext;
        const prefixDir = path.join(mainNativeDir, prefix);
        const placeholder = getPlaceholderBufferForUuid(uuid, placeholderSpecs);

        fs.mkdirSync(prefixDir, { recursive: true });
        const targetPath = path.join(prefixDir, fileName);
        writePlaceholderWithVerification(targetPath, placeholder, `${prefix}/${fileName}`);
        console.log(PACKAGE_NAME, `  创建: ${prefix}/${fileName} (${placeholder.length} bytes)`);
        count++;
    }

    return count;
}

/**
 * 简单模式：无 config.json 时，直接以 {uuid}.png 创建占位符
 */
function createPlaceholdersSimple(mainNativeDir, uuids, placeholderSpecs) {
    let count = 0;
    for (const uuid of uuids) {
        const prefix = uuid.substring(0, 2);
        const prefixDir = path.join(mainNativeDir, prefix);
        const placeholder = getPlaceholderBufferForUuid(uuid, placeholderSpecs);
        fs.mkdirSync(prefixDir, { recursive: true });
        const fileName = uuid + '.png';
        const targetPath = path.join(prefixDir, fileName);
        writePlaceholderWithVerification(targetPath, placeholder, `${prefix}/${fileName}`);
        console.log(PACKAGE_NAME, `  创建 (无 hash): ${prefix}/${uuid}.png (${placeholder.length} bytes)`);
        count++;
    }
    return count;
}

/**
 * 修正微信构建 settings.json，确保启动脚本从本地包读取。
 * 避免 assets.server 指向远程时出现首屏黑屏/卡住。
 */
function patchWeChatSettings(dest, platform) {
    if (platform !== 'wechatgame') return;

    const settingsPath = path.join(dest, 'src', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
        console.warn(PACKAGE_NAME, `settings.json 不存在，跳过修正: ${settingsPath}`);
        return;
    }

    try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (!settings.assets) {
            settings.assets = {};
        }

        const previousServer = settings.assets.server || '';
        if (previousServer !== '') {
            settings.assets.server = '';
            fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf-8');
            console.log(PACKAGE_NAME, `已修正 settings.json assets.server: "${previousServer}" -> ""`);
        } else {
            console.log(PACKAGE_NAME, 'settings.json assets.server 已是本地模式');
        }
    } catch (e) {
        console.warn(PACKAGE_NAME, `修正 settings.json 失败: ${e.message}`);
    }
}

/**
 * 为 wechatgame 的 game.js 注入首屏容错包装：
 * - first-screen 的 start/setProgress/end 最多等待 N ms，超时自动放行
 * - 避免真机上首屏 Promise 卡死导致一直黑屏
 */
function patchWeChatGameJs(dest, platform) {
    if (platform !== 'wechatgame') return;

    const gameJsPath = path.join(dest, 'game.js');
    if (!fs.existsSync(gameJsPath)) {
        console.warn(PACKAGE_NAME, `game.js 不存在，跳过容错注入: ${gameJsPath}`);
        return;
    }

    const marker = '__REMOTE_BUNDLE_CLEANER_FS_GUARD__';
    let content = fs.readFileSync(gameJsPath, 'utf-8');
    if (content.includes(marker)) {
        console.log(PACKAGE_NAME, 'game.js 首屏容错已注入，跳过');
        return;
    }

    const needle = "const firstScreen = require('./first-screen');";
    if (!content.includes(needle)) {
        console.warn(PACKAGE_NAME, 'game.js 结构不匹配，未找到 first-screen require，跳过容错注入');
        return;
    }

    const guardCode = `const firstScreenRaw = require('./first-screen');\n` +
        `const ${marker} = true;\n` +
        `const __fsGuardTimeout = 2500;\n` +
        `const __fsSafe = (promiseLike, label, fallbackValue) => {\n` +
        `    const p = Promise.resolve(promiseLike);\n` +
        `    const timeout = new Promise((resolve) => setTimeout(() => {\n` +
        `        console.warn('[boot-guard] first-screen timeout:', label);\n` +
        `        resolve(fallbackValue);\n` +
        `    }, __fsGuardTimeout));\n` +
        `    return Promise.race([p, timeout]).catch((err) => {\n` +
        `        console.warn('[boot-guard] first-screen error:', label, err);\n` +
        `        return fallbackValue;\n` +
        `    });\n` +
        `};\n` +
        `const firstScreen = {\n` +
        `    start: (...args) => __fsSafe(firstScreenRaw && firstScreenRaw.start ? firstScreenRaw.start(...args) : undefined, 'start'),\n` +
        `    setProgress: (...args) => __fsSafe(firstScreenRaw && firstScreenRaw.setProgress ? firstScreenRaw.setProgress(...args) : undefined, 'setProgress'),\n` +
        `    end: (...args) => __fsSafe(firstScreenRaw && firstScreenRaw.end ? firstScreenRaw.end(...args) : undefined, 'end'),\n` +
        `};`;

    content = content.replace(needle, guardCode);
    fs.writeFileSync(gameJsPath, content, 'utf-8');
    console.log(PACKAGE_NAME, '已为 game.js 注入 first-screen 真机容错包装');
}

// ============================
// 构建钩子
// ============================

exports.onBeforeBuild = async function (options) {
    const projectRoot = getProjectRoot(options);
    console.log(PACKAGE_NAME, `[PRE-BUILD][${HOOK_VERSION}] 项目路径: ${projectRoot}`);

    if (BUILD_STRATEGY === 'local-safe') {
        // 防止上次异常中断留下备份，先尝试恢复
        for (const sceneRelPath of SCENE_FILES) {
            const scenePath = path.join(projectRoot, sceneRelPath);
            restoreScene(scenePath);
        }
        console.log(PACKAGE_NAME, '[PRE-BUILD] local-safe 模式：跳过场景引用移除');
        return;
    }

    // 动态扫描 RemoteUI UUID
    const remoteUuids = scanRemoteUIUuids(projectRoot);
    if (remoteUuids.length === 0) {
        console.log(PACKAGE_NAME, '[PRE-BUILD] 未找到 RemoteUI UUID，跳过');
        return;
    }

    let totalPatched = 0;

    for (const sceneRelPath of SCENE_FILES) {
        const scenePath = path.join(projectRoot, sceneRelPath);
        totalPatched += backupAndPatchScene(scenePath, remoteUuids);
    }

    console.log(PACKAGE_NAME, `[PRE-BUILD] 完成: 共移除 ${totalPatched} 处 RemoteUI 引用`);
};

exports.onAfterBuild = async function (options, result) {
    const projectRoot = getProjectRoot(options);
    const platform = options.platform;

    // 获取构建输出路径（多重回退策略）
    const dest = resolveBuildDest(options, result);

    console.log(PACKAGE_NAME, `[POST-BUILD][${HOOK_VERSION}] 平台: ${platform}, 输出: ${dest}`);

    // 1. 恢复场景文件
    for (const sceneRelPath of SCENE_FILES) {
        const scenePath = path.join(projectRoot, sceneRelPath);
        restoreScene(scenePath);
    }

    if (!dest) {
        console.warn(PACKAGE_NAME, '[POST-BUILD] 无法获取构建输出路径，跳过资源清理');
        return;
    }

    // 0. 修正微信启动配置（避免 assets.server 指向远程导致首屏黑屏）
    patchWeChatSettings(dest, platform);
    patchWeChatGameJs(dest, platform);

    if (BUILD_STRATEGY === 'local-safe') {
        console.log(PACKAGE_NAME, '[POST-BUILD] local-safe 模式：不清理 native，不生成占位图（稳定优先）');
        return;
    }

    // 2. 动态扫描 RemoteUI UUID（用于占位符创建）
    const remoteUuids = scanRemoteUIUuids(projectRoot);
    const placeholderSpecs = collectRemoteUIPlaceholderSpecs(projectRoot);

    let totalRemoved = 0;

    // 3. 清理远程 Bundle 的 native 目录
    for (const bundleName of REMOTE_BUNDLES) {
        const nativeDir = path.join(dest, 'assets', bundleName, 'native');

        if (!fs.existsSync(nativeDir)) {
            console.log(PACKAGE_NAME, `跳过 ${bundleName}/native: 目录不存在`);
            continue;
        }

        const files = collectFiles(nativeDir);
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

        fs.rmSync(nativeDir, { recursive: true, force: true });
        totalRemoved += totalSize;

        console.log(PACKAGE_NAME, `已清理 ${bundleName}/native: ${files.length} 个文件, 释放 ${sizeMB} MB`);
    }

    // 4. 在 main/native/ 中为 RemoteUI 资源创建占位符 PNG
    if (remoteUuids.length > 0) {
        console.log(PACKAGE_NAME, '正在创建 main/native/ 尺寸匹配占位符 PNG...');
        const placeholderCount = createPlaceholders(dest, remoteUuids, placeholderSpecs);
        console.log(PACKAGE_NAME, `占位符处理完成: ${placeholderCount} 个文件`);
    }

    if (totalRemoved > 0) {
        console.log(PACKAGE_NAME, `[POST-BUILD] 完成: 释放 ${(totalRemoved / 1024 / 1024).toFixed(2)} MB`);
    } else {
        console.log(PACKAGE_NAME, '[POST-BUILD] 完成: 无需清理');
    }
};
