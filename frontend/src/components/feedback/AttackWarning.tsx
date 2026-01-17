'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { ATTACK_WARNING_DURATION, ANIMATION_CONFIG } from '@/lib/battleConstants'

export function AttackWarning() {
  const isBeingAttacked = useGameStore((state) => state.isBeingAttacked)
  const attackWarningEndTime = useGameStore((state) => state.attackWarningEndTime)
  const setBeingAttacked = useGameStore((state) => state.setBeingAttacked)

  // 自动关闭警告
  useEffect(() => {
    if (!attackWarningEndTime) return

    const checkTimer = setInterval(() => {
      if (Date.now() >= attackWarningEndTime) {
        setBeingAttacked(false)
        clearInterval(checkTimer)
      }
    }, 100)

    return () => clearInterval(checkTimer)
  }, [attackWarningEndTime, setBeingAttacked])

  return (
    <AnimatePresence>
      {isBeingAttacked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 pointer-events-none z-[90]"
        >
          {/* 四边红色渐变边框 */}
          {/* 顶部 */}
          <motion.div
            animate={{
              opacity: [
                ANIMATION_CONFIG.attackWarning.minOpacity,
                ANIMATION_CONFIG.attackWarning.maxOpacity,
                ANIMATION_CONFIG.attackWarning.minOpacity,
              ],
            }}
            transition={{
              duration: ANIMATION_CONFIG.attackWarning.breatheDuration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-red-500/60 to-transparent"
          />

          {/* 底部 */}
          <motion.div
            animate={{
              opacity: [
                ANIMATION_CONFIG.attackWarning.minOpacity,
                ANIMATION_CONFIG.attackWarning.maxOpacity,
                ANIMATION_CONFIG.attackWarning.minOpacity,
              ],
            }}
            transition={{
              duration: ANIMATION_CONFIG.attackWarning.breatheDuration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.2,
            }}
            className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-red-500/60 to-transparent"
          />

          {/* 左侧 */}
          <motion.div
            animate={{
              opacity: [
                ANIMATION_CONFIG.attackWarning.minOpacity,
                ANIMATION_CONFIG.attackWarning.maxOpacity,
                ANIMATION_CONFIG.attackWarning.minOpacity,
              ],
            }}
            transition={{
              duration: ANIMATION_CONFIG.attackWarning.breatheDuration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.4,
            }}
            className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-red-500/60 to-transparent"
          />

          {/* 右侧 */}
          <motion.div
            animate={{
              opacity: [
                ANIMATION_CONFIG.attackWarning.minOpacity,
                ANIMATION_CONFIG.attackWarning.maxOpacity,
                ANIMATION_CONFIG.attackWarning.minOpacity,
              ],
            }}
            transition={{
              duration: ANIMATION_CONFIG.attackWarning.breatheDuration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.6,
            }}
            className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-red-500/60 to-transparent"
          />

          {/* 角落强化 */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-red-500/50 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/50 to-transparent" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-red-500/50 to-transparent" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-red-500/50 to-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AttackWarning
