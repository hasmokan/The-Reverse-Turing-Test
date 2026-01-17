/**
 * 环境配置 - 硬编码值
 * 用于 ModelScope 等不支持环境变量的部署环境
 */

export const ENV_CONFIG = {
  // 后端 API 地址
  API_URL: 'https://turing.kinaz.me',

  // WebSocket 地址
  WS_URL: 'wss://turing.kinaz.me',

  // 视觉模型 API 配置（阶跃星辰）
  VISION_API_URL: 'https://api.stepfun.com/v1',
  VISION_API_KEY: '4FlSdYVfkMrcVqaex9PXjLUOg8b3MazJ8GdY993DymL6sN3DwEYW39HwuowYdn7xC',
  VISION_MODEL: 'step-1o-turbo-vision',
} as const

export default ENV_CONFIG
