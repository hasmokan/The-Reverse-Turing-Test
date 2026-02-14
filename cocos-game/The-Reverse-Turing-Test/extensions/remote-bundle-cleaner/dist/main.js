'use strict';

/**
 * 扩展入口 — 仅用于满足 Cocos Creator 扩展加载要求。
 * 实际构建清理逻辑在 hooks.js 中。
 */
exports.load = function () {
    console.log('[RemoteBundleCleaner] 扩展已加载');
};

exports.unload = function () {
    console.log('[RemoteBundleCleaner] 扩展已卸载');
};
