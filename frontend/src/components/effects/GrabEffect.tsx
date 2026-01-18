'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'

export function GrabEffect({ isInsideStage = false }: { isInsideStage?: boolean }) {
  const eliminationAnimation = useGameStore((state) => state.eliminationAnimation)
  const clearEliminationAnimation = useGameStore((state) => state.clearEliminationAnimation)
  const removeItem = useGameStore((state) => state.removeItem)
  const clearFishVotes = useGameStore((state) => state.clearFishVotes)
  const items = useGameStore((state) => state.items)

  const [isAnimating, setIsAnimating] = useState(false)
  const [showKickFoot, setShowKickFoot] = useState(false)
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 })
  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(null)
  const [kickDirection, setKickDirection] = useState<'left' | 'right'>('right')

  // 使用 ref 保存动画目标信息
  const animationTargetRef = useRef<{
    fishId: string
    fishName: string
    isAI: boolean
  } | null>(null)

  // 当 eliminationAnimation 变化时，捕获目标信息并开始动画
  useEffect(() => {
    if (!eliminationAnimation) {
      return
    }

    // 只在新动画开始时执行
    if (animationTargetRef.current?.fishId === eliminationAnimation.fishId) {
      return
    }

    const targetItem = items.find((item) => item.id === eliminationAnimation.fishId)
    if (!targetItem) {
      // 找不到鱼，直接清除
      clearEliminationAnimation()
      return
    }

    // 保存目标信息
    animationTargetRef.current = {
      fishId: eliminationAnimation.fishId,
      fishName: eliminationAnimation.fishName,
      isAI: eliminationAnimation.isAI,
    }

    setTargetPosition({ ...targetItem.position })
    setTargetImageUrl(targetItem.imageUrl)
    // 随机踢出方向
    setKickDirection(Math.random() > 0.5 ? 'left' : 'right')

    // 先显示脚，再踢飞
    setShowKickFoot(true)
    setTimeout(() => {
      setIsAnimating(true)
    }, 300)


  }, [eliminationAnimation, items, clearEliminationAnimation])

  // 动画完成回调
  const handleAnimationComplete = () => {
    if (!animationTargetRef.current) return

    const { fishId } = animationTargetRef.current


    // 移除鱼
    removeItem(fishId)
    clearFishVotes(fishId)

    // 清除状态
    clearEliminationAnimation()
    animationTargetRef.current = null
    setIsAnimating(false)
    setShowKickFoot(false)
    setTargetImageUrl(null)
  }

  if (!eliminationAnimation || !targetImageUrl) {
    return null
  }

  const target = animationTargetRef.current

  return (
    <div className={`${isInsideStage ? 'absolute' : 'fixed'} inset-0 pointer-events-none z-[80]`}>
      {/* 踢脚动画 */}
      <AnimatePresence>
        {showKickFoot && (
          <motion.div
            className="absolute text-6xl"
            style={{
              left: targetPosition.x + (kickDirection === 'right' ? -60 : 60),
              top: targetPosition.y,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{
              x: kickDirection === 'right' ? -100 : 100,
              rotate: kickDirection === 'right' ? -45 : 45,
              scale: 0.5,
              opacity: 0,
            }}
            animate={{
              x: kickDirection === 'right' ? 30 : -30,
              rotate: kickDirection === 'right' ? 30 : -30,
              scale: 1.5,
              opacity: 1,
            }}
            exit={{
              x: kickDirection === 'right' ? -50 : 50,
              opacity: 0,
              scale: 0.8,
            }}
            transition={{
              duration: 0.25,
              ease: 'easeOut',
            }}
          >
            {kickDirection === 'right' ? '🦶' : '🦶'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 踢出去的鱼 */}
      {isAnimating && (
        <motion.div
          className="absolute flex items-center justify-center"
          style={{
            left: targetPosition.x,
            top: targetPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{
            x: 0,
            y: 0,
            rotate: 0,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: kickDirection === 'right' ? 1000 : -1000,
            y: [0, -150, -100],
            rotate: kickDirection === 'right' ? 1080 : -1080,
            scale: [1, 1.2, 0.2],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1], // easeOutQuint - 快速起步，缓慢结束
            times: [0, 0.3, 1],
          }}
          onAnimationComplete={handleAnimationComplete}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={targetImageUrl}
            alt="被踢出的鱼"
            className="w-24 h-24 object-contain"
          />
        </motion.div>
      )}

      {/* 踢击特效 - 冲击波 */}
      {showKickFoot && (
        <motion.div
          className="absolute rounded-full border-4 border-orange-400 bg-orange-200/20"
          style={{
            left: targetPosition.x,
            top: targetPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ width: 0, height: 0, opacity: 1 }}
          animate={{ width: 200, height: 200, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
        />
      )}

      {/* 踢击特效 - POW! 文字 */}
      {showKickFoot && (
        <motion.div
          className="absolute font-bold text-4xl text-orange-500"
          style={{
            left: targetPosition.x,
            top: targetPosition.y - 50,
            transform: 'translate(-50%, -50%)',
            textShadow: '2px 2px 0 #fff, -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff',
          }}
          initial={{ scale: 0, rotate: -15, opacity: 0 }}
          animate={{ scale: [0, 1.5, 1], rotate: [-15, 10, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, times: [0, 0.3, 1] }}
        >
          💥 KICK!
        </motion.div>
      )}

      {/* 踢击特效 - 速度线 */}
      {isAnimating && [...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 bg-gradient-to-r from-orange-400 to-transparent rounded-full"
          style={{
            left: targetPosition.x,
            top: targetPosition.y + (i - 2) * 15,
            width: 60,
            transform: kickDirection === 'right' ? 'scaleX(1)' : 'scaleX(-1)',
          }}
          initial={{ opacity: 0, x: 0 }}
          animate={{
            opacity: [0, 1, 0],
            x: kickDirection === 'right' ? [0, 100, 200] : [0, -100, -200]
          }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
        />
      ))}

      {/* 结果文字 */}
      <AnimatePresence>
        {target && isAnimating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.3 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className={`
                px-6 py-3 rounded-2xl font-bold text-2xl
                ${target.isAI
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                  : 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                }
              `}
            >
              {target.isAI ? '🎯 抓到 AI 了！' : '😱 误杀人类！'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GrabEffect
