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
      className="flex items-center justify-between px-5 py-4 bg-white/95 backdrop-blur-md scribble-card border-purple-400 relative overflow-hidden"
    >
      {/* 背景装饰纹理 */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,.03) 10px, rgba(0,0,0,.03) 20px)'
        }} />
      </div>

      {/* 主题名称 */}
      <motion.div
        whileHover={{ scale: 1.05, rotate: -2 }}
        className="flex items-center gap-2 relative z-10"
      >
        <motion.span
          animate={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-3xl"
        >
          🐠
        </motion.span>
        <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-sketch">
          {theme?.theme_name || '深海鱼缸'}
        </span>
      </motion.div>

      {/* 状态指示器 */}
      <div className="flex items-center gap-3 relative z-10">
        {/* 物体计数 */}
        <motion.div
          whileHover={{ scale: 1.1, rotate: -3 }}
          className="flex items-center gap-2 bg-gradient-to-br from-blue-100 to-blue-200 px-4 py-2 rounded-full border-2 border-blue-300 shadow-md hand-drawn-border"
        >
          <motion.span
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎨
          </motion.span>
          <span className="font-mono font-bold text-blue-700 text-lg">{totalItems}</span>
        </motion.div>

        {/* AI 计数 - 危险指示 */}
        <motion.div
          animate={{
            scale: dangerLevel > 0.6 ? [1, 1.08, 1] : 1,
            rotate: dangerLevel > 0.6 ? [0, -2, 2, 0] : 0,
          }}
          transition={{ repeat: Infinity, duration: 0.6 }}
          whileHover={{ scale: 1.15, rotate: 5 }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 shadow-md hand-drawn-border ${
            dangerLevel > 0.8
              ? 'bg-gradient-to-br from-red-500 to-red-600 text-white border-red-700 animate-danger-pulse'
              : dangerLevel > 0.5
              ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border-orange-400'
              : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 border-gray-300'
          }`}
        >
          <motion.span
            animate={{ scale: dangerLevel > 0.7 ? [1, 1.2, 1] : 1 }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            🤖
          </motion.span>
          <span className="font-mono font-bold text-lg">
            {aiCount}/{maxAI}
          </span>
          {dangerLevel > 0.7 && (
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="ml-1"
            >
              ⚠️
            </motion.span>
          )}
        </motion.div>

        {/* 游戏阶段 */}
        {phase === 'voting' && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-full font-bold border-2 border-red-600 shadow-lg hand-drawn-border"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="flex items-center gap-2"
            >
              🔍 投票中
            </motion.span>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export default GameHeader
