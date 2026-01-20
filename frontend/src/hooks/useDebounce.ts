'use client'

import { useCallback, useRef } from 'react'

/**
 * 防抖回调 hook
 * @param callback 要执行的回调函数
 * @param delay 防抖延迟时间（毫秒），默认 300ms
 * @returns 防抖后的回调函数
 */
export function useDebounceCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCallRef.current < delay) {
        return
      }
      lastCallRef.current = now
      callback(...args)
    },
    [callback, delay]
  )
}

export default useDebounceCallback
