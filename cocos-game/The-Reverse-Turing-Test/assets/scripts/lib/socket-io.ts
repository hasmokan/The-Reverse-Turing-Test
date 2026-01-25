/**
 * socket.io-client ESM 包装模块
 * 从预打包的 socket.io.esm.js 重新导出
 */

// @ts-ignore - 从本地预打包文件导入
import * as SocketIO from './socket.io.esm.js';

export const io = SocketIO.io;
export type Socket = ReturnType<typeof io>;
export const Manager = SocketIO.Manager;
