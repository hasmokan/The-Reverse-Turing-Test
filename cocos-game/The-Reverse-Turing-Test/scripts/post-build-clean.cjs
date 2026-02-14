#!/usr/bin/env node
'use strict';

/**
 * 构建后处理脚本：清理远程 Bundle 的 native 资源
 *
 * RemoteUI bundle 配置为 isRemote=true，priority=8（高于 main 的 7），
 * 资源只存在于 RemoteUI bundle 中，不会被复制到 main bundle。
 * 构建后只需删除 RemoteUI/native/ 目录，运行时通过 COS 远程加载。
 *
 * 用法：
 *   node scripts/post-build-clean.cjs
 *   node scripts/post-build-clean.cjs <构建输出目录>
 */

const fs = require('fs');
const path = require('path');

const REMOTE_BUNDLES = ['RemoteUI'];
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');

function findLatestBuildDir() {
    if (!fs.existsSync(BUILD_DIR)) {
        console.error('❌ build/ 目录不存在，请先构建项目');
        process.exit(1);
    }

    const entries = fs.readdirSync(BUILD_DIR, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({
            name: e.name,
            fullPath: path.join(BUILD_DIR, e.name),
            mtime: fs.statSync(path.join(BUILD_DIR, e.name)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);

    if (entries.length === 0) {
        console.error('❌ build/ 下没有构建目录');
        process.exit(1);
    }

    return entries[0].fullPath;
}

function collectFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const fullPath = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else {
                files.push({ path: fullPath, name: entry.name, size: fs.statSync(fullPath).size });
            }
        }
    };
    walk(dir);
    return files;
}

function cleanBuild(buildDest) {
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

        console.log(`   ✅ 已删除 ${bundleName}/native/ — 释放 ${sizeMB} MB\n`);
    }

    // 验证 main/native/ 状态
    const mainNativeDir = path.join(buildDest, 'assets', 'main', 'native');
    if (fs.existsSync(mainNativeDir)) {
        const mainFiles = collectFiles(mainNativeDir);
        console.log(`📌 main/native/ 保留 ${mainFiles.length} 个文件:`);
        mainFiles.forEach(f => {
            console.log(`   ${path.extname(f.name).padEnd(5)} ${(f.size / 1024).toFixed(1).padStart(8)} KB  ${f.name}`);
        });
        console.log('');
    }

    if (totalSaved > 0) {
        console.log(`🎉 清理完成，总计释放 ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
    } else {
        console.log('ℹ️  无需清理');
    }
}

const buildDest = process.argv[2] || findLatestBuildDir();
cleanBuild(buildDest);
