'use client'

import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/store'

export function GameHeader() {
  const totalItems = useGameStore((state) => state.totalItems)
  const aiCount = useGameStore((state) => state.aiCount)
  const theme = useGameStore((state) => state.theme)
  const phase = useGameStore((state) => state.phase)

  const maxAI = theme?.game_rules.max_imposters || 5
  const dangerLevel = aiCount / maxAI

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg"
    >
      {/* 主题名称 */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🐠</span>
        <span className="font-bold text-gray-800">
          {theme?.theme_name || '深海鱼缸'}
        </span>
      </div>

      {/* 状态指示器 */}
      <div className="flex items-center gap-4">
        {/* 物体计数 */}
        <div className="flex items-center gap-2 bg-blue-100 px-3 py-1.5 rounded-full">
          <span>🎨</span>
          <span className="font-mono font-bold text-blue-700">{totalItems}</span>
        </div>

        {/* AI 计数 - 危险指示 */}
        <motion.div
          animate={{
            scale: dangerLevel > 0.6 ? [1, 1.05, 1] : 1,
          }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            dangerLevel > 0.8
              ? 'bg-red-500 text-white'
              : dangerLevel > 0.5
              ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          <span>🤖</span>
          <span className="font-mono font-bold">
            {aiCount}/{maxAI}
          </span>
        </motion.div>

        {/* 游戏阶段 */}
        {phase === 'voting' && (
          <div className="bg-red-500 text-white px-3 py-1.5 rounded-full animate-pulse">
            🔍 投票中
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default GameHeader
