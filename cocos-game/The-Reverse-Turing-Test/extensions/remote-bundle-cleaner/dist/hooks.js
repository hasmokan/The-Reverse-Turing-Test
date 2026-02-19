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

const PACKAGE_NAME = 'remote-bundle-cleaner';
const REMOTE_BUNDLES = ['RemoteUI'];

// 需要处理的场景文件（相对于项目根目录）
const SCENE_FILES = [
    'assets/scenes/MainScene.scene',
    'assets/scenes/MultiPlayerScene.scene',
];

// SpriteFrame sub-asset 后缀
const SPRITE_FRAME_SUFFIX = '@f9941';

// 1×1 透明 RGBA PNG 占位符（69 字节，Color Type 6 = RGBA，Bit Depth 8）
const PLACEHOLDER_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUEArkJggg==',
    'base64'
);

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
    console.log(PACKAGE_NAME, 'builder hooks loaded');
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
        const pattern = `"([^"]+)":\\s*\\{\\s*"__uuid__":\\s*"${uuid}${SPRITE_FRAME_SUFFIX}",\\s*"__expectedType__":\\s*"cc\\.SpriteFrame"\\s*\\}`;
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

/**
 * 在 main/native/ 中为 RemoteUI 资源创建 1×1 透明 PNG 占位符
 *
 * 策略:
 *   Pass 1 — 扫描 main/native/ 已有文件，匹配 RemoteUI UUID 的大图替换为占位符
 *   Pass 2 — 对 Pass 1 未匹配到的 UUID，读取 config.json 获取预期路径并创建占位符
 *
 * Native 文件路径格式（来源: cocos/asset/asset-manager/url-transformer.ts#combine）:
 *   {nativeBase}/{uuid[0:2]}/{uuid}{.nativeVer}{ext}
 *   其中 uuid 为完整解码后的 UUID（含连字符）
 */
function createPlaceholders(dest, remoteUuids) {
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
                if (oldSize > PLACEHOLDER_PNG.length) {
                    savedBytes += oldSize - PLACEHOLDER_PNG.length;
                    fs.writeFileSync(filePath, PLACEHOLDER_PNG);
                    console.log(PACKAGE_NAME, `  替换: ${prefix}/${file} (${oldSize} → ${PLACEHOLDER_PNG.length} bytes)`);
                    count++;
                }
            }
        }
    }

    // Pass 2: 对未找到文件的 UUID，从 config.json 获取预期路径并创建占位符
    const missingUuids = remoteUuids.filter(u => !foundUuids.has(u));
    if (missingUuids.length > 0) {
        const created = createMissingPlaceholders(dest, mainNativeDir, missingUuids);
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
function createMissingPlaceholders(dest, mainNativeDir, missingUuids) {
    const configPath = path.join(dest, 'assets', 'main', 'config.json');

    if (!fs.existsSync(configPath)) {
        console.log(PACKAGE_NAME, 'config.json 不存在，使用简单模式创建占位符');
        return createPlaceholdersSimple(mainNativeDir, missingUuids);
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
        console.warn(PACKAGE_NAME, `解析 config.json 失败: ${e.message}`);
        return createPlaceholdersSimple(mainNativeDir, missingUuids);
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

        fs.mkdirSync(prefixDir, { recursive: true });
        fs.writeFileSync(path.join(prefixDir, fileName), PLACEHOLDER_PNG);
        console.log(PACKAGE_NAME, `  创建: ${prefix}/${fileName} (${PLACEHOLDER_PNG.length} bytes)`);
        count++;
    }

    return count;
}

/**
 * 简单模式：无 config.json 时，直接以 {uuid}.png 创建占位符
 */
function createPlaceholdersSimple(mainNativeDir, uuids) {
    let count = 0;
    for (const uuid of uuids) {
        const prefix = uuid.substring(0, 2);
        const prefixDir = path.join(mainNativeDir, prefix);
        fs.mkdirSync(prefixDir, { recursive: true });
        fs.writeFileSync(path.join(prefixDir, uuid + '.png'), PLACEHOLDER_PNG);
        console.log(PACKAGE_NAME, `  创建 (无 hash): ${prefix}/${uuid}.png (${PLACEHOLDER_PNG.length} bytes)`);
        count++;
    }
    return count;
}

// ============================
// 构建钩子
// ============================

exports.onBeforeBuild = async function (options) {
    const projectRoot = getProjectRoot(options);
    console.log(PACKAGE_NAME, `[PRE-BUILD] 项目路径: ${projectRoot}`);

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

    console.log(PACKAGE_NAME, `[POST-BUILD] 平台: ${platform}, 输出: ${dest}`);

    // 1. 恢复场景文件
    for (const sceneRelPath of SCENE_FILES) {
        const scenePath = path.join(projectRoot, sceneRelPath);
        restoreScene(scenePath);
    }

    if (!dest) {
        console.warn(PACKAGE_NAME, '[POST-BUILD] 无法获取构建输出路径，跳过资源清理');
        return;
    }

    // 2. 动态扫描 RemoteUI UUID（用于占位符创建）
    const remoteUuids = scanRemoteUIUuids(projectRoot);

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
        console.log(PACKAGE_NAME, '正在创建 main/native/ 占位符 PNG...');
        const placeholderCount = createPlaceholders(dest, remoteUuids);
        console.log(PACKAGE_NAME, `占位符处理完成: ${placeholderCount} 个文件`);
    }

    if (totalRemoved > 0) {
        console.log(PACKAGE_NAME, `[POST-BUILD] 完成: 释放 ${(totalRemoved / 1024 / 1024).toFixed(2)} MB`);
    } else {
        console.log(PACKAGE_NAME, '[POST-BUILD] 完成: 无需清理');
    }
};
