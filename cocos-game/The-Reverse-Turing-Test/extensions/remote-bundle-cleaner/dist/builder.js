'use strict';

/**
 * 构建扩展入口 — 注册 builder hooks
 *
 * Cocos Creator 3.8 要求 contributions.builder 指向的模块
 * 导出 configs 对象，其中通过 hooks 字段引用实际钩子脚本。
 *
 * '*' 表示匹配所有构建平台（wechatgame、web-mobile 等）。
 */

exports.configs = {
    '*': {
        hooks: './hooks',
    },
};
