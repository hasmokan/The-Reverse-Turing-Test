'use strict';

/**
 * Cocos Creator 构建扩展 — 自动处理 RemoteUI 资源的构建优化
 *
 * 构建前（onBeforeBuild）：
 *   - 备份场景文件
 *   - 移除场景中对 RemoteUI 图片的直接引用，防止被打包到 main bundle
 *
 * 构建后（onAfterBuild）：
 *   - 恢复场景文件
 *   - 清理 RemoteUI/native/ 目录（运行时通过 COS 远程加载，无需本地保留）
 *
 * 注意: 不清理 main/native/ 和 main/import/ 中的文件，
 *       因为 config.json 仍然引用它们，删除会导致运行时错误。
 *       正确的做法是通过 onBeforeBuild 移除场景引用，从根本上阻止
 *       RemoteUI 图片被打包进 main bundle。
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

// RemoteUI 资源的 UUID 列表（从 assets/RemoteUI/*.meta 中提取）
const REMOTE_UUIDS = [
    'd1405970-cbdb-46d5-b1e1-fff1578057de',
    'd67307a6-08dc-40ee-9429-29ede466a79a',
    'd5aa00f5-93a8-495f-9b8f-445af3bb52bd',
    '83ed7d27-94a2-4456-9016-2784fa187603',
    '82ecad44-924c-41ce-b5f2-3780d7a0189c',
    'd7f72387-3e07-4794-b399-c3b134238f57',
    '850caea2-9131-4a62-8104-cbd0078dcb9f',
    '07ef7d44-22fc-4f0e-bf89-1791545bd885',
    '3d3493d4-2ed2-4052-ae26-ff34f1ebfdfd',
    '7dd00fed-216e-4a6b-affb-c24ecdb67a33',
];

// 引用匹配模式（_spriteFrame 引用 RemoteUI 的 SpriteFrame）
const SPRITE_FRAME_SUFFIX = '@f9941';

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
 * 备份场景文件并移除 RemoteUI 引用
 */
function backupAndPatchScene(scenePath) {
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
    let patchCount = 0;

    for (const uuid of REMOTE_UUIDS) {
        // 匹配 _spriteFrame 引用 RemoteUI SpriteFrame 的 JSON 片段
        const pattern = `"_spriteFrame":\\s*\\{\\s*"__uuid__":\\s*"${uuid}${SPRITE_FRAME_SUFFIX}",\\s*"__expectedType__":\\s*"cc\\.SpriteFrame"\\s*\\}`;
        const regex = new RegExp(pattern, 'g');

        if (regex.test(content)) {
            // 重建 regex（test 会移动 lastIndex）
            content = content.replace(new RegExp(pattern, 'g'), '"_spriteFrame": null');
            patchCount++;
        }
    }

    if (patchCount > 0) {
        fs.writeFileSync(scenePath, content, 'utf-8');
        console.log(PACKAGE_NAME, `${path.basename(scenePath)}: 移除 ${patchCount} 个 RemoteUI 引用`);
    } else {
        console.log(PACKAGE_NAME, `${path.basename(scenePath)}: 无需移除引用`);
    }

    return patchCount;
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

// ============================
// 构建钩子
// ============================

exports.onBeforeBuild = async function (options) {
    const projectRoot = getProjectRoot(options);
    console.log(PACKAGE_NAME, `[PRE-BUILD] 项目路径: ${projectRoot}`);

    let totalPatched = 0;

    for (const sceneRelPath of SCENE_FILES) {
        const scenePath = path.join(projectRoot, sceneRelPath);
        totalPatched += backupAndPatchScene(scenePath);
    }

    console.log(PACKAGE_NAME, `[PRE-BUILD] 完成: 共移除 ${totalPatched} 个 RemoteUI 引用`);
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

    let totalRemoved = 0;

    // 2. 清理远程 Bundle 的 native 目录
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

    // 注意: 不清理 main/native/ 和 main/import/ 中的文件
    // config.json 仍引用这些文件，删除会导致运行时错误
    // 依赖 onBeforeBuild 移除场景引用，从根本上阻止 RemoteUI 图片进入 main bundle

    if (totalRemoved > 0) {
        console.log(PACKAGE_NAME, `[POST-BUILD] 完成: 释放 ${(totalRemoved / 1024 / 1024).toFixed(2)} MB`);
    } else {
        console.log(PACKAGE_NAME, '[POST-BUILD] 完成: 无需清理');
    }
};
