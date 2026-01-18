/**
 * 视觉模型 API 服务模块
 * 使用阶跃星辰 Step 视觉理解模型判断画作是否符合主题
 * API 文档: https://platform.stepfun.com/docs/llm/vision
 */

import { ENV_CONFIG } from '@/config/env'

// API 配置 - 从配置文件读取
const VISION_API_URL = ENV_CONFIG.VISION_API_URL
const VISION_API_KEY = ENV_CONFIG.VISION_API_KEY
const VISION_MODEL = ENV_CONFIG.VISION_MODEL

export interface ImageReviewResult {
  isValid: boolean
  confidence: number
  detectedContent: string
  suggestion: string
  rawResponse?: string
}

export interface ImageReviewOptions {
  imageBase64: string
  themeName: string
  themeKeywords: string[]
}

/**
 * 调用阶跃星辰视觉模型判断图片内容
 */
export async function reviewImageWithMiniMax(
  options: ImageReviewOptions
): Promise<ImageReviewResult> {
  const { imageBase64, themeName, themeKeywords } = options

  const apiKey = getMinimaxApiKey()
  if (!apiKey) {
    throw new Error('未配置视觉模型 API Key')
  }

  // 构建提示词
  const prompt = buildReviewPrompt(themeName, themeKeywords)


  try {
    // 阶跃星辰 API 兼容 OpenAI 格式
    const requestBody = {
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64, // 支持 data:image/png;base64,... 格式
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }

    const response = await fetch(`${VISION_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })


    if (!response.ok) {
      const errorText = await response.text()
      console.error('[StepVision] API Error:', response.status, errorText)
      throw new Error(`视觉 API 错误: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    const content = data.choices?.[0]?.message?.content || ''

    // 解析模型响应
    return parseReviewResponse(content, themeKeywords)
  } catch (error) {
    console.error('[StepVision] Request failed:', error)
    throw error
  }
}

/**
 * 构建审核提示词
 */
function buildReviewPrompt(themeName: string, keywords: string[]): string {

  return `你是一个专业的简笔画审核助手。请分析这张图片，判断它是否是一幅符合"${themeName}"主题的**丑陋风格简笔画**。

## 主题要求
绘制的内容应该是：鱼

## 简笔画风格规范（这是一种特定的"丑陋简笔画"风格）

### 整体风格特征：
- 刻意丑陋、幼稚、粗糙的数字手指画风格
- 看起来像是用基础画图软件画的，线条抖动不稳定
- 无压感变化，笔触粗糙简单

### 鱼的形态特征：
- 单个模糊的、难以辨认的团块，隐约呈现鱼的形状
- 形状怪异、凹凸不平
- 轮廓由粗糙的单线构成（固定笔刷），线条抖动、可能不闭合
- 眼睛要么是一个极其粗糙的实心圆点，要么完全没有
- 没有鱼鳍或极度简化
- "尾巴"只是一个随机的、不对称的线条延伸
- 填充线条潦草，可能溢出轮廓边界

### 背景：
- 应该是纯白色背景，无其他元素
- 无UI界面、工具栏、手机边框等

请按以下JSON格式回复（不要输出其他内容）：
{
  "isValid": true/false,
  "confidence": 0-100的置信度数字,
  "detectedContent": "检测到的主要内容描述",
  "suggestion": "如果不符合，给出具体的改进建议"
}

## 判断标准优先级：
1. **必须是简笔画风格** - 如果是照片、精细绘画、3D渲染等，直接判定不符合
2. **必须能识别出鱼的基本特征** - 即使很丑很抽象，也要有类似鱼的轮廓/形态
3. **越丑越幼稚越好** - 画得太精美反而不符合要求
4. **完全无关内容（如房子、汽车、人物等）判定为不符合**
5. **空白画布或纯色块判定为不符合**`
}

/**
 * 解析模型响应
 */
function parseReviewResponse(content: string, keywords: string[]): ImageReviewResult {
  // 防御性检查：确保 keywords 是有效数组
  const safeKeywords = Array.isArray(keywords) && keywords.length > 0 ? keywords : ['鱼', '海洋生物']

  try {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        isValid: Boolean(parsed.isValid),
        confidence: Number(parsed.confidence) || 50,
        detectedContent: String(parsed.detectedContent || '无法识别'),
        suggestion: String(parsed.suggestion || ''),
        rawResponse: content,
      }
    }
  } catch (e) {
    console.warn('[StepVision] Failed to parse JSON response:', e)
  }

  // 如果解析失败，尝试从文本中推断
  const lowerContent = content.toLowerCase()
  const hasPositiveWords = ['符合', '通过', 'valid', 'true', '是的'].some((w) =>
    lowerContent.includes(w)
  )
  const hasKeyword = safeKeywords.some((k) => lowerContent.includes(k.toLowerCase()))

  return {
    isValid: hasPositiveWords || hasKeyword,
    confidence: 50,
    detectedContent: content.slice(0, 100),
    suggestion: hasPositiveWords ? '' : '建议重新绘制符合主题的内容',
    rawResponse: content,
  }
}

/**
 * 本地模拟审核（用于无 API Key 时的降级处理）
 */
export function mockReviewImage(options: ImageReviewOptions): ImageReviewResult {
  const { themeName } = options

  return {
    isValid: true,
    confidence: 85,
    detectedContent: `看起来像是一个${themeName}主题相关的涂鸦`,
    suggestion: '',
  }
}

/**
 * 检查是否配置了 API Key（优先环境变量，其次 localStorage）
 */
export function hasMinimaxApiKey(): boolean {
  // 优先检查环境变量
  if (VISION_API_KEY && VISION_API_KEY.length > 10) {
    return true
  }
  // 其次检查 localStorage
  if (typeof window === 'undefined') {
    return false
  }
  const key = localStorage.getItem('vision_api_key')
  return Boolean(key && key.length > 10)
}

/**
 * 获取 API Key（优先环境变量，其次 localStorage）
 */
export function getMinimaxApiKey(): string | null {
  // 优先使用环境变量
  if (VISION_API_KEY && VISION_API_KEY.length > 10) {
    return VISION_API_KEY
  }
  // 其次使用 localStorage
  if (typeof window === 'undefined') return null
  return localStorage.getItem('vision_api_key')
}

/**
 * 保存 API Key 到 localStorage（用于临时覆盖）
 */
export function setMinimaxApiKey(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('vision_api_key', key)
}

/**
 * 清除 localStorage 中的 API Key
 */
export function clearMinimaxApiKey(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('vision_api_key')
}

/**
 * 检查是否使用环境变量配置
 */
export function isUsingEnvApiKey(): boolean {
  return Boolean(VISION_API_KEY && VISION_API_KEY.length > 10)
}
