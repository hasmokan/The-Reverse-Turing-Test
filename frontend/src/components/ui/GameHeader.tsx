'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/lib/store'

export function GameHeader() {
  const router = useRouter()
  const totalItems = useGameStore((state) => state.totalItems)
  const aiCount = useGameStore((state) => state.aiCount)
  const theme = useGameStore((state) => state.theme)
  const phase = useGameStore((state) => state.phase)

  const maxAI = theme?.game_rules.max_imposters || 5
  const dangerLevel = aiCount / maxAI

  // 返回首页
  const handleGoHome = () => {
    router.push('/')
  }

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 bg-white/95 backdrop-blur-md scribble-card border-purple-400 relative overflow-hidden"
    >
      {/* 背景装饰纹理 */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,.03) 10px, rgba(0,0,0,.03) 20px)'
        }} />
      </div>

      {/* 左侧：返回按钮 + 主题名称 */}
      <div className="flex items-center gap-2 sm:gap-3 relative z-10 flex-shrink-0">
        {/* 返回首页按钮 */}
        <motion.button
          onClick={handleGoHome}
          whileHover={{ scale: 1.1, x: -3 }}
          whileTap={{ scale: 0.9 }}
          className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-full border-2 border-gray-300 shadow-md hover:border-purple-400 transition-colors flex-shrink-0"
          title="返回首页"
        >
          <span className="text-base sm:text-lg">🏠</span>
        </motion.button>

        {/* 主题名称 */}
        <motion.div
          whileHover={{ scale: 1.05, rotate: -2 }}
          className="flex items-center gap-1 sm:gap-2"
        >
          <motion.span
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-xl sm:text-3xl"
          >
            🐠
          </motion.span>
          <span className="font-bold text-sm sm:text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-sketch whitespace-nowrap">
            {theme?.theme_name || '深海鱼缸'}
          </span>
        </motion.div>
      </div>

      {/* 状态指示器 */}
      <div className="flex items-center gap-2 sm:gap-3 relative z-10">
        {/* 物体计数 */}
        <motion.div
          whileHover={{ scale: 1.1, rotate: -3 }}
          className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-br from-blue-100 to-blue-200 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border-2 border-blue-300 shadow-md hand-drawn-border whitespace-nowrap"
        >
          <motion.span
            animate={{
              rotate: [0, 15, -15, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-sm sm:text-base whitespace-nowrap font-extrabold"
          >
            <motion.span
              className="sm:hidden text-blue-600"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              剩余
            </motion.span>
            <span className="hidden sm:inline">剩下的鱼</span>
          </motion.span>
          <span className="font-mono font-bold text-blue-700 text-sm sm:text-lg">{totalItems}</span>
        </motion.div>

        {/* AI 计数 - 危险指示 */}
        <motion.div
          animate={{
            scale: dangerLevel > 0.6 ? [1, 1.08, 1] : 1,
            rotate: dangerLevel > 0.6 ? [0, -2, 2, 0] : 0,
          }}
          transition={{ repeat: Infinity, duration: 0.6 }}
          whileHover={{ scale: 1.15, rotate: 5 }}
          className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border-2 shadow-md hand-drawn-border whitespace-nowrap ${dangerLevel > 0.8
            ? 'bg-gradient-to-br from-red-500 to-red-600 text-white border-red-700 animate-danger-pulse'
            : dangerLevel > 0.5
              ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 border-orange-400'
              : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 border-gray-300'
            }`}
        >
          <motion.span
            animate={{
              scale: dangerLevel > 0.7 ? [1, 1.2, 1] : [1, 1.08, 1]
            }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="text-sm sm:text-base whitespace-nowrap font-extrabold"
          >
            <motion.span
              className="sm:hidden bg-gradient-to-r from-purple-600 to-red-500 bg-clip-text text-transparent"
              animate={{
                opacity: [0.8, 1, 0.8],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              AI伪装者
            </motion.span>
            <span className="hidden sm:inline">AI伪装者</span>
          </motion.span>
          <span className="font-mono font-bold text-sm sm:text-lg">
            {aiCount}/{maxAI}
          </span>
          {dangerLevel > 0.7 && (
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="ml-0.5 sm:ml-1 hidden sm:inline"
            >
              ⚠️
            </motion.span>
          )}
        </motion.div>

        {/* 游戏阶段 - 小屏幕简化显示 */}
        {phase === 'voting' && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold border-2 border-red-600 shadow-lg hand-drawn-border"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
            >
              🔍 <span className="hidden sm:inline">投票中</span>
            </motion.span>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export default GameHeader
