'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { COOLDOWN_DURATION, BATTLE_COLORS } from '@/lib/battleConstants'

export function CooldownHUD() {
  const bullet = useGameStore((state) => state.bullet)
  const reloadBullet = useGameStore((state) => state.reloadBullet)
  const [progress, setProgress] = useState(bullet.loaded ? 100 : 0)
  const [showReloadEffect, setShowReloadEffect] = useState(false)

  // 计算倒计时进度
  useEffect(() => {
    if (bullet.loaded) {
      setProgress(100)
      return
    }

    if (!bullet.cooldownEndTime) {
      setProgress(0)
      return
    }

    const updateProgress = () => {
      const now = Date.now()
      const remaining = bullet.cooldownEndTime! - now
      const elapsed = COOLDOWN_DURATION - remaining
      const newProgress = Math.min(100, (elapsed / COOLDOWN_DURATION) * 100)

      setProgress(newProgress)

      if (remaining <= 0) {
        setProgress(100)
        reloadBullet()
        setShowReloadEffect(true)
        setTimeout(() => setShowReloadEffect(false), 500)
      }
    }

    const timer = setInterval(updateProgress, 50)
    updateProgress()

    return () => clearInterval(timer)
  }, [bullet.cooldownEndTime, bullet.loaded, reloadBullet])

  // SVG 圆形进度条参数
  const size = 72
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <motion.div
        className={`
          relative w-[${size}px] h-[${size}px]
          flex items-center justify-center
          ${bullet.loaded ? 'cursor-pointer' : 'cursor-not-allowed'}
        `}
        animate={showReloadEffect ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        {/* 背景圆 */}
        <svg
          width={size}
          height={size}
          className="absolute transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* 进度弧 */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bullet.loaded ? '#ef4444' : '#9ca3af'}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            initial={false}
            animate={{
              strokeDashoffset,
              stroke: bullet.loaded ? '#ef4444' : '#9ca3af',
            }}
            transition={{ duration: 0.1 }}
          />
        </svg>

        {/* 中心内容 */}
        <div
          className={`
            w-14 h-14 rounded-full
            flex items-center justify-center
            ${bullet.loaded
              ? 'bg-red-500 shadow-lg shadow-red-500/50'
              : 'bg-gray-600'
            }
            transition-all duration-300
          `}
        >
          {bullet.loaded ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-2xl"
            >
              🎯
            </motion.span>
          ) : (
            <span className="text-white text-xs font-bold">
              {Math.ceil((COOLDOWN_DURATION - (Date.now() - (bullet.cooldownEndTime! - COOLDOWN_DURATION))) / 1000)}s
            </span>
          )}
        </div>

        {/* 装填完成光效 */}
        <AnimatePresence>
          {showReloadEffect && (
            <motion.div
              initial={{ scale: 0.8, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 rounded-full bg-red-500/50"
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* 状态文字 */}
      <div className="mt-2 text-center">
        <span
          className={`
            text-xs font-medium
            ${bullet.loaded ? 'text-red-400' : 'text-gray-400'}
          `}
        >
          {bullet.loaded ? '已装填' : '冷却中'}
        </span>
      </div>
    </div>
  )
}

export default CooldownHUD
