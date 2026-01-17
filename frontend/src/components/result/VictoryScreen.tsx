'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/lib/store'
import { ConfettiEffect } from '@/components/effects'

export function VictoryScreen() {
  const router = useRouter()
  const gameResult = useGameStore((state) => state.gameResult)
  const clearGameResult = useGameStore((state) => state.clearGameResult)
  const resetGame = useGameStore((state) => state.resetGame)

  const [showConfetti, setShowConfetti] = useState(false)

  const isVisible = gameResult?.isVictory === true

  useEffect(() => {
    if (isVisible) {
      // 延迟显示撒花
      const timer = setTimeout(() => {
        setShowConfetti(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  const handlePlayAgain = () => {
    clearGameResult()
    resetGame()
    router.push('/')
  }

  if (!isVisible) return null

  return (
    <>
      <ConfettiEffect active={showConfetti} />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              delay: 0.2,
            }}
            className="relative w-[90%] max-w-md bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-8 shadow-2xl"
          >
            {/* 装饰光效 */}
            <div className="absolute inset-0 rounded-3xl bg-white/10 animate-pulse" />

            {/* 内容 */}
            <div className="relative z-10 text-center">
              {/* 胜利图标 */}
              <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  delay: 0.4,
                }}
                className="text-7xl mb-4"
              >
                🏆
              </motion.div>

              {/* 标题 */}
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-3xl font-bold text-white mb-2"
              >
                胜利！
              </motion.h1>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-white/80 text-lg mb-6"
              >
                所有 AI 已被清除！
              </motion.p>

              {/* 统计 */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-white/20 rounded-xl p-4 mb-6"
              >
                <div className="flex justify-around">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {gameResult?.humanRemaining || 0}
                    </div>
                    <div className="text-white/70 text-sm">人类存活</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">0</div>
                    <div className="text-white/70 text-sm">AI 残余</div>
                  </div>
                </div>
              </motion.div>

              {/* MVP */}
              {gameResult?.mvpPlayerName && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8, type: 'spring' }}
                  className="bg-yellow-400/20 rounded-xl p-4 mb-6 border-2 border-yellow-400/50"
                >
                  <div className="text-yellow-300 text-sm mb-1">🌟 MVP</div>
                  <div className="text-white font-bold text-xl">
                    {gameResult.mvpPlayerName}
                  </div>
                </motion.div>
              )}

              {/* 按钮 */}
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePlayAgain}
                className="w-full py-4 bg-white text-green-600 font-bold text-lg rounded-xl shadow-lg hover:bg-gray-100 transition-colors"
              >
                🎮 再来一局
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

export default VictoryScreen
