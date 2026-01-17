/**
 * 环境配置 - 硬编码值
 * 用于 ModelScope 等不支持环境变量的部署环境
 */

// 后端服务器地址（用于服务端代理）
export const BACKEND_URL = 'http://83.229.126.150:3001'

/**
 * 检测是否在 HTTPS 环境
 */
function isHttpsEnv(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'https:'
}

/**
 * 获取 API URL
 * HTTPS 环境使用相对路径（走 Next.js 代理），HTTP 环境直接请求
 */
export function getApiUrl(): string {
  return isHttpsEnv() ? '' : BACKEND_URL
}

/**
 * 获取 WebSocket URL
 * HTTPS 环境禁用（返回空），HTTP 环境直接连接
 */
export function getWsUrl(): string {
  return isHttpsEnv() ? '' : 'ws://83.229.126.150:3001'
}

export const ENV_CONFIG = {
  // 视觉模型 API 配置（阶跃星辰）- 已经是 HTTPS，无需代理
  VISION_API_URL: 'https://api.stepfun.com/v1',
  VISION_API_KEY: '4FlSdYVfkMrcVqaex9PXjLUOg8b3MazJ8GdY993DymL6sN3DwEYW39HwuowYdn7xC',
  VISION_MODEL: 'step-1o-turbo-vision',

  // 兼容旧代码的 getter
  get API_URL() {
    return getApiUrl()
  },
  get WS_URL() {
    return getWsUrl()
  },
} as const

export default ENV_CONFIG
