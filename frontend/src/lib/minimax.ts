/**
 * 视觉模型 API 服务模块
 * 用于调用 ModelScope Qwen3-VL 视觉模型判断画作是否符合主题
 */

// API 配置 - 从环境变量读取
const VISION_API_URL = process.env.NEXT_PUBLIC_VISION_API_URL || 'https://api-inference.modelscope.cn/v1'
const VISION_API_KEY = process.env.NEXT_PUBLIC_VISION_API_KEY || ''
const VISION_MODEL = process.env.NEXT_PUBLIC_VISION_MODEL || 'Qwen/Qwen3-VL-235B-A22B-Instruct'

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
 * 调用 Qwen3-VL 视觉模型判断图片内容
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

  console.log('[VisionAPI] 开始审核图片...')
  console.log('[VisionAPI] API URL:', VISION_API_URL)
  console.log('[VisionAPI] Model:', VISION_MODEL)
  console.log('[VisionAPI] 主题:', themeName)
  console.log('[VisionAPI] 关键词:', themeKeywords)

  try {
    const requestBody = {
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
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

    console.log('[VisionAPI] 响应状态:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[VisionAPI] API Error:', response.status, errorText)
      throw new Error(`视觉 API 错误: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('[VisionAPI] 响应数据:', JSON.stringify(data, null, 2))

    const content = data.choices?.[0]?.message?.content || ''
    console.log('[VisionAPI] AI 回复:', content)

    // 解析模型响应
    return parseReviewResponse(content, themeKeywords)
  } catch (error) {
    console.error('[VisionAPI] Request failed:', error)
    throw error
  }
}

/**
 * 构建审核提示词
 */
function buildReviewPrompt(themeName: string, keywords: string[]): string {
  const keywordList = keywords.join('、')

  return `你是一个图像内容审核助手。请分析这张图片，判断它是否符合"${themeName}"主题。

该主题要求绘制的内容应该是以下之一：${keywordList}

请按以下JSON格式回复（不要输出其他内容）：
{
  "isValid": true/false,
  "confidence": 0-100的置信度数字,
  "detectedContent": "检测到的主要内容描述",
  "suggestion": "如果不符合主题，给出友好的建议"
}

判断标准：
1. 图片内容需要能够辨认出是上述主题相关的物体
2. 儿童简笔画风格是可以接受的，不要求画得很精细
3. 如果是完全无关的内容（如房子、汽车等），判定为不符合
4. 如果内容难以辨认但有相关特征，给予通过但置信度较低`
}

/**
 * 解析模型响应
 */
function parseReviewResponse(content: string, keywords: string[]): ImageReviewResult {
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
    console.warn('[MiniMax] Failed to parse JSON response:', e)
  }

  // 如果解析失败，尝试从文本中推断
  const lowerContent = content.toLowerCase()
  const hasPositiveWords = ['符合', '通过', 'valid', 'true', '是的'].some((w) =>
    lowerContent.includes(w)
  )
  const hasKeyword = keywords.some((k) => lowerContent.includes(k.toLowerCase()))

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
  if (typeof window === 'undefined') return false
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
