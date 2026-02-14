#!/usr/bin/env node
'use strict';

/**
 * 构建辅助脚本：解决 RemoteUI 图片被重复打包到 main bundle 的问题
 *
 * 原理：
 *   MainScene.scene 中的 Sprite 直接引用了 RemoteUI 的图片（方便编辑器预览），
 *   导致 Cocos Creator 构建时将图片复制到 main/native/。
 *   本脚本在构建前临时移除这些引用，构建后恢复并清理。
 *   运行时由 GameBootstrap.applyRemoteImages() 动态加载图片。
 *
 * 用法：
 *   node scripts/build-helper.cjs pre    ← 构建前运行（备份场景、移除引用）
 *   node scripts/build-helper.cjs post   ← 构建后运行（恢复场景、清理产物）
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCENE_PATH = path.join(PROJECT_ROOT, 'assets', 'scenes', 'MainScene.scene');
const BACKUP_PATH = SCENE_PATH + '.bak';
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const REMOTE_BUNDLES = ['RemoteUI'];

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

// ============================
// PRE-BUILD：备份场景 + 移除引用
// ============================
function preBuild() {
    if (!fs.existsSync(SCENE_PATH)) {
        console.error('❌ 场景文件不存在:', SCENE_PATH);
        process.exit(1);
    }

    if (fs.existsSync(BACKUP_PATH)) {
        console.log('⚠️  发现上次的备份文件，先恢复...');
        fs.copyFileSync(BACKUP_PATH, SCENE_PATH);
    }

    // 备份原始场景
    fs.copyFileSync(SCENE_PATH, BACKUP_PATH);
    console.log('📋 已备份场景: MainScene.scene → MainScene.scene.bak');

    // 读取并修改场景
    let content = fs.readFileSync(SCENE_PATH, 'utf-8');
    let patchCount = 0;

    for (const uuid of REMOTE_UUIDS) {
        // 匹配: "_spriteFrame": { "__uuid__": "UUID@f9941", "__expectedType__": "cc.SpriteFrame" }
        const pattern = `"_spriteFrame": {\\s*"__uuid__": "${uuid}@f9941",\\s*"__expectedType__": "cc.SpriteFrame"\\s*}`;
        const regex = new RegExp(pattern, 'g');

        if (regex.test(content)) {
            content = content.replace(new RegExp(pattern, 'g'), '"_spriteFrame": null');
            patchCount++;
            console.log(`   ✏️  已移除引用: ${uuid.substring(0, 8)}...`);
        }
    }

    fs.writeFileSync(SCENE_PATH, content, 'utf-8');
    console.log(`\n✅ 预处理完成：移除 ${patchCount} 个 RemoteUI 引用`);
    console.log('👉 现在请在 Cocos Creator 中构建微信小游戏');
    console.log('👉 构建完成后运行: node scripts/build-helper.cjs post\n');
}

// ============================
// POST-BUILD：恢复场景 + 清理构建
// ============================
function postBuild() {
    // 恢复场景
    if (fs.existsSync(BACKUP_PATH)) {
        fs.copyFileSync(BACKUP_PATH, SCENE_PATH);
        fs.unlinkSync(BACKUP_PATH);
        console.log('📋 已恢复场景: MainScene.scene.bak → MainScene.scene');
    } else {
        console.log('⚠️  未找到备份文件，跳过恢复');
    }

    // 清理构建产物
    const buildDest = findLatestBuildDir();
    if (!buildDest) return;

    console.log(`\n🔍 构建目录: ${buildDest}\n`);

    let totalSaved = 0;

    for (const bundleName of REMOTE_BUNDLES) {
        const nativeDir = path.join(buildDest, 'assets', bundleName, 'native');

        if (!fs.existsSync(nativeDir)) {
            console.log(`⏭️  ${bundleName}/native/ 不存在，跳过`);
            continue;
        }

        const files = collectFiles(nativeDir);
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

        console.log(`📦 ${bundleName}/native/: ${files.length} 个文件, ${sizeMB} MB`);
        files.forEach(f => {
            console.log(`   ${path.extname(f.name).padEnd(5)} ${(f.size / 1024).toFixed(1).padStart(8)} KB  ${f.name}`);
        });

        fs.rmSync(nativeDir, { recursive: true, force: true });
        totalSaved += totalSize;
        console.log(`   ✅ 已删除 — 释放 ${sizeMB} MB\n`);
    }

    // 验证 main/native
    const mainNativeDir = path.join(buildDest, 'assets', 'main', 'native');
    if (fs.existsSync(mainNativeDir)) {
        const mainFiles = collectFiles(mainNativeDir);
        const mainSize = mainFiles.reduce((sum, f) => sum + f.size, 0);
        console.log(`📌 main/native/: ${mainFiles.length} 个文件 (${(mainSize / 1024).toFixed(1)} KB)`);
        mainFiles.forEach(f => {
            console.log(`   ${path.extname(f.name).padEnd(5)} ${(f.size / 1024).toFixed(1).padStart(8)} KB  ${f.name}`);
        });
        if (mainFiles.length > 1) {
            console.log('   ⚠️  main/native/ 中有多余文件！可能仍有跨 bundle 引用');
        }
        console.log('');
    }

    if (totalSaved > 0) {
        console.log(`🎉 完成！总计释放 ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
    } else {
        console.log('ℹ️  无需清理');
    }
}

// ============================
// 工具函数
// ============================
function findLatestBuildDir() {
    if (!fs.existsSync(BUILD_DIR)) {
        console.error('❌ build/ 目录不存在');
        return null;
    }

    const entries = fs.readdirSync(BUILD_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({
            name: e.name,
            fullPath: path.join(BUILD_DIR, e.name),
            mtime: fs.statSync(path.join(BUILD_DIR, e.name)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);

    return entries.length > 0 ? entries[0].fullPath : null;
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

// ============================
// 主逻辑
// ============================
const command = process.argv[2];

if (command === 'pre') {
    preBuild();
} else if (command === 'post') {
    postBuild();
} else {
    console.log('用法:');
    console.log('  node scripts/build-helper.cjs pre   ← 构建前运行');
    console.log('  node scripts/build-helper.cjs post  ← 构建后运行');
    console.log('');
    console.log('流程:');
    console.log('  1. node scripts/build-helper.cjs pre');
    console.log('  2. 在 Cocos Creator 中构建微信小游戏');
    console.log('  3. node scripts/build-helper.cjs post');
}
