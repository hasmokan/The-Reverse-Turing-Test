'use client'

import { useState, useCallback } from 'react'
import { useGameStore } from '@/lib/store'
import {
  reviewImageWithMiniMax,
  mockReviewImage,
  hasMinimaxApiKey,
  ImageReviewResult,
} from '@/lib/minimax'

export type ReviewStatus = 'idle' | 'reviewing' | 'approved' | 'rejected' | 'error'

interface UseImageReviewReturn {
  status: ReviewStatus
  result: ImageReviewResult | null
  error: string | null
  reviewImage: (imageBase64: string) => Promise<ImageReviewResult>
  reset: () => void
  hasApiKey: boolean
}

/**
 * 画作审核 Hook
 * 使用视觉模型判断用户画作是否符合主题
 */
export function useImageReview(): UseImageReviewReturn {
  const [status, setStatus] = useState<ReviewStatus>('idle')
  const [result, setResult] = useState<ImageReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const theme = useGameStore((state) => state.theme)

  const reviewImage = useCallback(
    async (imageBase64: string): Promise<ImageReviewResult> => {
      console.log('[useImageReview] reviewImage called')
      console.log('[useImageReview] theme:', theme)

      if (!theme) {
        console.error('[useImageReview] Theme not set!')
        throw new Error('主题未设置')
      }

      console.log('[useImageReview] Setting status to reviewing')
      setStatus('reviewing')
      setError(null)
      setResult(null)

      const options = {
        imageBase64,
        themeName: theme.theme_name,
        themeKeywords: theme.ai_settings.keywords,
      }
      console.log('[useImageReview] options:', options)

      try {
        let reviewResult: ImageReviewResult

        // 检查是否有 API Key
        const hasKey = hasMinimaxApiKey()
        console.log('[useImageReview] hasMinimaxApiKey():', hasKey)

        if (hasKey) {
          console.log('[useImageReview] Calling reviewImageWithMiniMax...')
          reviewResult = await reviewImageWithMiniMax(options)
        } else {
          // 无 API Key 时使用模拟审核
          console.warn('[useImageReview] No API key configured, using mock review')
          await new Promise((resolve) => setTimeout(resolve, 1000))
          reviewResult = mockReviewImage(options)
        }

        console.log('[useImageReview] Review completed:', reviewResult)
        setResult(reviewResult)
        setStatus(reviewResult.isValid ? 'approved' : 'rejected')
        console.log('[useImageReview] Status set to:', reviewResult.isValid ? 'approved' : 'rejected')

        return reviewResult
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '审核失败'
        setError(errorMessage)
        setStatus('error')

        // 出错时默认通过（降级策略）
        const fallbackResult: ImageReviewResult = {
          isValid: true,
          confidence: 0,
          detectedContent: '审核服务暂不可用',
          suggestion: '',
        }
        setResult(fallbackResult)

        return fallbackResult
      }
    },
    [theme]
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setError(null)
  }, [])

  return {
    status,
    result,
    error,
    reviewImage,
    reset,
    hasApiKey: hasMinimaxApiKey(),
  }
}

export default useImageReview
