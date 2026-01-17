'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { ELIMINATION_ANIMATION_DURATION, ANIMATION_CONFIG } from '@/lib/battleConstants'
import { generateKillToast } from '@/lib/toastMessages'

// 机械手 SVG 路径
const MechanicalArmSVG = () => (
  <svg width="80" height="200" viewBox="0 0 80 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 手臂主体 */}
    <rect x="30" y="0" width="20" height="140" fill="#4A5568" rx="4" />

    {/* 关节 */}
    <circle cx="40" cy="50" r="12" fill="#2D3748" stroke="#718096" strokeWidth="2" />
    <circle cx="40" cy="100" r="12" fill="#2D3748" stroke="#718096" strokeWidth="2" />

    {/* 爪子 */}
    <g className="claw">
      {/* 左爪 */}
      <path
        d="M15 145 Q20 160 25 175 L35 175 Q30 160 30 145 Z"
        fill="#4A5568"
        stroke="#718096"
        strokeWidth="1"
      />
      {/* 右爪 */}
      <path
        d="M65 145 Q60 160 55 175 L45 175 Q50 160 50 145 Z"
        fill="#4A5568"
        stroke="#718096"
        strokeWidth="1"
      />
      {/* 中爪 */}
      <path
        d="M35 145 L35 180 L45 180 L45 145 Z"
        fill="#4A5568"
        stroke="#718096"
        strokeWidth="1"
      />
    </g>

    {/* 螺丝装饰 */}
    <circle cx="40" cy="30" r="3" fill="#718096" />
    <circle cx="40" cy="70" r="3" fill="#718096" />
    <circle cx="40" cy="120" r="3" fill="#718096" />
  </svg>
)

export function GrabEffect() {
  const eliminationAnimation = useGameStore((state) => state.eliminationAnimation)
  const clearEliminationAnimation = useGameStore((state) => state.clearEliminationAnimation)
  const removeItem = useGameStore((state) => state.removeItem)
  const clearFishVotes = useGameStore((state) => state.clearFishVotes)
  const showToast = useGameStore((state) => state.showToast)
  const items = useGameStore((state) => state.items)

  const [stage, setStage] = useState<'idle' | 'descend' | 'grab' | 'ascend'>('idle')
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!eliminationAnimation) {
      setStage('idle')
      return
    }

    // 获取目标鱼的位置
    const targetItem = items.find((item) => item.id === eliminationAnimation.fishId)
    if (targetItem) {
      setTargetPosition({
        x: targetItem.position.x,
        y: targetItem.position.y,
      })
    }

    // 动画序列
    setStage('descend')

    const grabTimer = setTimeout(() => {
      setStage('grab')
    }, ELIMINATION_ANIMATION_DURATION.grab)

    const ascendTimer = setTimeout(() => {
      setStage('ascend')
    }, ELIMINATION_ANIMATION_DURATION.grab + ELIMINATION_ANIMATION_DURATION.pull)

    const completeTimer = setTimeout(() => {
      // 移除鱼
      removeItem(eliminationAnimation.fishId)
      clearFishVotes(eliminationAnimation.fishId)

      // 显示 Toast
      const toastContent = generateKillToast(
        eliminationAnimation.fishName,
        eliminationAnimation.isAI
      )
      showToast(
        eliminationAnimation.isAI ? 'kill_ai' : 'kill_human',
        toastContent
      )

      // 清除动画状态
      clearEliminationAnimation()
      setStage('idle')
    }, ELIMINATION_ANIMATION_DURATION.grab + ELIMINATION_ANIMATION_DURATION.pull + ELIMINATION_ANIMATION_DURATION.exit)

    return () => {
      clearTimeout(grabTimer)
      clearTimeout(ascendTimer)
      clearTimeout(completeTimer)
    }
  }, [eliminationAnimation, items, removeItem, clearFishVotes, showToast, clearEliminationAnimation])

  if (!eliminationAnimation || stage === 'idle') {
    return null
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[80]">
      {/* 机械手动画 */}
      <motion.div
        className="absolute"
        style={{
          left: targetPosition.x,
          transform: 'translateX(-50%)',
        }}
        initial={{ top: -200 }}
        animate={{
          top:
            stage === 'descend'
              ? targetPosition.y - 100
              : stage === 'grab'
              ? targetPosition.y - 80
              : -200,
        }}
        transition={{
          duration:
            stage === 'descend'
              ? ANIMATION_CONFIG.grabEffect.grabDuration
              : stage === 'ascend'
              ? ANIMATION_CONFIG.grabEffect.exitDuration
              : ANIMATION_CONFIG.grabEffect.pullDuration,
          ease: 'easeInOut',
        }}
      >
        <MechanicalArmSVG />
      </motion.div>

      {/* 被抓取时的鱼（跟随机械手上升） */}
      {(stage === 'grab' || stage === 'ascend') && (
        <motion.div
          className="absolute w-16 h-16 flex items-center justify-center"
          style={{
            left: targetPosition.x,
            transform: 'translateX(-50%)',
          }}
          initial={{ top: targetPosition.y }}
          animate={{
            top: stage === 'ascend' ? -100 : targetPosition.y,
            rotate: stage === 'ascend' ? [0, -10, 10, -10, 0] : 0,
          }}
          transition={{
            duration: ANIMATION_CONFIG.grabEffect.exitDuration,
            ease: 'easeIn',
          }}
        >
          <span className="text-4xl">🐟</span>
        </motion.div>
      )}

      {/* 处决文字效果 */}
      <AnimatePresence>
        {stage === 'grab' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <span
              className={`
                text-4xl font-bold
                ${eliminationAnimation.isAI ? 'text-green-500' : 'text-red-500'}
                drop-shadow-lg
              `}
            >
              {eliminationAnimation.isAI ? '捕获成功!' : '误杀!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default GrabEffect
