'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/lib/store'
import { CrackEffect } from '@/components/effects'

export function DefeatScreen() {
  const router = useRouter()
  const gameResult = useGameStore((state) => state.gameResult)
  const clearGameResult = useGameStore((state) => state.clearGameResult)
  const resetGame = useGameStore((state) => state.resetGame)

  const [showCrack, setShowCrack] = useState(false)

  const isVisible = gameResult?.isVictory === false
  const isTooManyHumanKilled = gameResult?.reason === 'too_many_human_killed'

  useEffect(() => {
    if (isVisible) {
      setShowCrack(true)
    }
  }, [isVisible])

  const handleRestart = () => {
    clearGameResult()
    resetGame()
    router.push('/')
  }

  if (!isVisible) return null

  // 根据战败原因选择不同的样式配置
  const defeatConfig = isTooManyHumanKilled
    ? {
        icon: '😭',
        title: '误伤太多！',
        subtitle: '无辜的好鱼死亡太多了...',
        bgGradient: 'from-orange-800 to-red-900',
        borderColor: 'border-orange-500/30',
        statBg: 'bg-orange-500/10',
        statBorder: 'border-orange-500/30',
        buttonBg: 'bg-orange-500 hover:bg-orange-600',
        fishEmoji: '🐟💀',
      }
    : {
        icon: '💀',
        title: '游戏结束',
        subtitle: 'AI 已经占领了鱼缸...',
        bgGradient: 'from-gray-800 to-gray-900',
        borderColor: 'border-red-500/30',
        statBg: 'bg-red-500/10',
        statBorder: 'border-red-500/30',
        buttonBg: 'bg-red-500 hover:bg-red-600',
        fishEmoji: '🤖🐟',
      }

  return (
    <>
      <CrackEffect active={showCrack} />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
              delay: 0.8,
            }}
            className={`relative w-[90%] max-w-md bg-gradient-to-br ${defeatConfig.bgGradient} rounded-3xl p-8 shadow-2xl border ${defeatConfig.borderColor}`}
          >
            {/* 内容 */}
            <div className="relative z-10 text-center">
              {/* 失败图标 */}
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{
                  duration: 0.5,
                  delay: 1,
                }}
                className="text-7xl mb-4"
              >
                {defeatConfig.icon}
              </motion.div>

              {/* 标题 */}
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.1 }}
                className={`text-3xl font-bold mb-2 ${isTooManyHumanKilled ? 'text-orange-400' : 'text-red-500'}`}
              >
                {defeatConfig.title}
              </motion.h1>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="text-gray-400 text-lg mb-6"
              >
                {defeatConfig.subtitle}
              </motion.p>

              {/* 统计 */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.3 }}
                className={`${defeatConfig.statBg} rounded-xl p-4 mb-6 border ${defeatConfig.statBorder}`}
              >
                <div className={`flex ${isTooManyHumanKilled ? 'justify-around' : 'justify-around'}`}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-300">
                      {gameResult?.humanRemaining || 0}
                    </div>
                    <div className="text-gray-500 text-sm">人类存活</div>
                  </div>
                  {isTooManyHumanKilled && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-400">
                        {gameResult?.humanKilled || 0}
                      </div>
                      <div className="text-gray-500 text-sm">误杀人类</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${isTooManyHumanKilled ? 'text-gray-300' : 'text-red-500'}`}>
                      {gameResult?.aiRemaining || 0}
                    </div>
                    <div className="text-gray-500 text-sm">AI 残留</div>
                  </div>
                </div>
              </motion.div>

              {/* 鱼掉落动画 */}
              <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  delay: 1.4,
                  type: 'spring',
                  stiffness: 100,
                }}
                className="flex justify-center gap-2 mb-6"
              >
                {isTooManyHumanKilled ? (
                  // 误杀人类场景：显示死亡的鱼 + 墓碑
                  <>
                    {[...Array(3)].map((_, i) => (
                      <motion.span
                        key={i}
                        initial={{ y: 0, rotate: 0 }}
                        animate={{
                          y: [0, -5, 0],
                          rotate: 180, // 翻白肚
                        }}
                        transition={{
                          delay: 1.5 + i * 0.1,
                          duration: 1.5,
                          repeat: Infinity,
                          repeatType: 'reverse',
                        }}
                        className="text-2xl"
                      >
                        🐟
                      </motion.span>
                    ))}
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 1.8 }}
                      className="text-2xl"
                    >
                      🪦
                    </motion.span>
                  </>
                ) : (
                  // AI 占领场景：显示灰色的鱼
                  [...Array(5)].map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ y: -30, rotate: 0 }}
                      animate={{
                        y: [0, 10, 0],
                        rotate: [0, -10, 10, 0],
                      }}
                      transition={{
                        delay: 1.5 + i * 0.1,
                        duration: 2,
                        repeat: Infinity,
                        repeatType: 'reverse',
                      }}
                      className="text-2xl opacity-50 grayscale"
                    >
                      🐟
                    </motion.span>
                  ))
                )}
              </motion.div>

              {/* 按钮 */}
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRestart}
                className={`w-full py-4 ${defeatConfig.buttonBg} text-white font-bold text-lg rounded-xl shadow-lg transition-colors`}
              >
                🔄 重新开始
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

export default DefeatScreen
