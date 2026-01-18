'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { themes } from '@/config/themes'
import { useGameStore } from '@/lib/store'
import { createRoom, getOrCreateRoom, convertThemeResponse } from '@/lib/api'

export default function HomePage() {
  const router = useRouter()
  const setTheme = useGameStore((state) => state.setTheme)
  const setRoomId = useGameStore((state) => state.setRoomId)
  const setPhase = useGameStore((state) => state.setPhase)
  const syncState = useGameStore((state) => state.syncState)

  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelectRoom = async (themeId: string) => {
    try {
      setLoading(themeId)
      setError(null)

      // 调用 API 获取或创建房间（先查询活跃房间，没有则创建）
      const { roomCode, theme } = await getOrCreateRoom(themeId)

      // 设置游戏状态
      setTheme(convertThemeResponse(theme))
      setRoomId(roomCode)
      setPhase('viewing')
      // 新房间或刚加入时使用默认初始值，后续通过 WebSocket 同步
      syncState({
        totalItems: 0,
        aiCount: 0,
        turbidity: 0,
      })

      router.push('/game')
    } catch (err) {
      console.error('Failed to join/create room:', err)
      setError('加入房间失败，请重试')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-200 crayon-texture overflow-hidden relative">
      {/* 背景装饰涂鸦 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute top-10 left-10 text-6xl"
        >
          ⭐
        </motion.div>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-20 right-20 text-5xl"
        >
          ✨
        </motion.div>
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute top-1/4 right-10 text-4xl"
        >
          🎨
        </motion.div>
      </div>

      {/* Logo 和标题 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="text-center mb-4 sm:mb-8 md:mb-10 relative z-10"
      >
        {/* 左侧浮动提示词 */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="absolute left-[-120px] top-1/2 -translate-y-1/2 hidden lg:block"
        >
          <motion.div
            animate={{ y: [0, -8, 0], rotate: [-3, 3, -3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="px-3 py-2 bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-300 rounded-lg shadow-md transform -rotate-6"
          >
            <span className="text-sm font-bold text-purple-700 whitespace-nowrap">🗳️ 投票驱逐 AI</span>
          </motion.div>
          <motion.div
            animate={{ y: [0, 6, 0], rotate: [2, -2, 2] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="mt-4 px-3 py-2 bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 rounded-lg shadow-md transform rotate-3"
          >
            <span className="text-sm font-bold text-yellow-700 whitespace-nowrap">🕵️ 《找出AI间谍》</span>
          </motion.div>
        </motion.div>

        {/* 右侧浮动提示词 */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="absolute right-[-100px] top-1/2 -translate-y-1/2 hidden lg:block"
        >
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [3, -3, 3] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            className="px-3 py-2 bg-gradient-to-r from-blue-100 to-cyan-100 border-2 border-blue-400 rounded-lg shadow-md transform rotate-6"
          >
            <span className="text-sm font-bold text-blue-700 whitespace-nowrap">🐟 《鱼人杀》</span>
          </motion.div>
        </motion.div>

        <motion.div
          animate={{
            rotate: 360
          }}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          className="mb-3 sm:mb-6 filter drop-shadow-2xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/backgrounds/20260118-015657.png"
            alt="Logo"
            className="w-40 h-40 sm:w-28 sm:h-28 md:w-36 md:h-36 mx-auto object-contain"
          />
        </motion.div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl sm:text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 font-sketch mb-2 sm:mb-4 transform -rotate-1"
          style={{
            textShadow: '3px 3px 0px rgba(255,182,193,0.5), -2px -2px 0px rgba(135,206,250,0.3)'
          }}
        >
          反方向的图灵
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-base sm:text-xl md:text-2xl text-pink-600 font-sketch transform rotate-1 mb-1 sm:mb-2"
        >
          The Reverse Turing Test
        </motion.p>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
          className="inline-block px-4 py-1.5 sm:px-6 sm:py-2 bg-yellow-300 border-3 border-yellow-600 rounded-full transform -rotate-2 shadow-lg"
        >
          <p className="text-sm text-yellow-900 font-bold">
            🎨 通过投票找出 AI 生成的间谍，你也可以涂鸦出属于自己的鱼！
          </p>
        </motion.div>
      </motion.div>

      {/* 房间选择卡片 */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-md space-y-5 relative z-10"
      >
        {/* <motion.h2
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 text-center mb-6 font-sketch transform -rotate-1"
        >
          🚀 选择主题房间
        </motion.h2> */}

        {/* 错误提示 */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-100 text-red-700 rounded-lg text-center"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </motion.div>
        )}

        {Object.values(themes).map((theme, index) => {
          // 只有第一个主题（鱼缸）解锁，其他上锁
          const isLocked = theme.theme_id !== 'fish_tank_01'

          return (
            <motion.button
              key={theme.theme_id}
              initial={{ x: index % 2 === 0 ? -50 : 50, opacity: 0, rotate: index % 2 === 0 ? -5 : 5 }}
              animate={{ x: 0, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.4 + index * 0.15, type: 'spring', stiffness: 100 }}
              whileHover={isLocked ? {} : {
                scale: loading ? 1 : 1.05,
                rotate: index % 2 === 0 ? 2 : -2,
                transition: { duration: 0.3 }
              }}
              whileTap={isLocked ? {} : { scale: 0.95, rotate: 0 }}
              onClick={() => !isLocked && handleSelectRoom(theme.theme_id)}
              disabled={loading !== null || isLocked}
              className={`w-full scribble-card overflow-hidden group relative ${isLocked ? 'cursor-not-allowed' : ''} disabled:opacity-70`}
              style={{
                borderColor: isLocked ? '#9CA3AF' : (theme.palette[0] || '#FF6B9D')
              }}
            >
              {/* 上锁遮罩 */}
              {isLocked && (
                <div className="absolute inset-0 bg-gray-900/70 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
                  <motion.div
                    animate={{
                      rotate: [0, -10, 10, -5, 5, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-6xl mb-4"
                  >
                    🔒
                  </motion.div>
                  <p className="text-white/90 text-lg font-bold text-center px-4 font-sketch">
                    观猹的瓜园～
                  </p>
                  <p className="text-white/60 text-sm mt-2">
                    敬请期待...
                  </p>
                </div>
              )}

              {/* 加载遮罩 */}
              {loading === theme.theme_id && (
                <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="text-4xl"
                  >
                    🎨
                  </motion.div>
                </div>
              )}

              {/* 预览图 */}
              <div
                className={`h-40 bg-cover bg-center relative overflow-hidden ${isLocked ? 'grayscale' : ''}`}
                style={{
                  backgroundImage: `url(${theme.assets.background_url})`,
                }}
              >
                {/* 渐变遮罩 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                {/* 星星装饰 */}
                {!isLocked && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute top-3 right-3 text-2xl"
                  >
                    ✨
                  </motion.div>
                )}

                {/* 主题标签 */}
                <motion.div
                  whileHover={isLocked ? {} : { scale: 1.1, rotate: -3 }}
                  className={`absolute top-4 left-4 px-5 py-2 bg-white/95 hand-drawn-border border-2 text-lg font-bold shadow-xl transform -rotate-2 ${isLocked ? 'opacity-60' : ''}`}
                  style={{
                    borderColor: isLocked ? '#9CA3AF' : (theme.palette[1] || '#FFA06B')
                  }}
                >
                  <span className="mr-2">{theme.theme_id === 'fish_tank_01' ? '🐠' : '☕'}</span>
                  <span className="text-gray-800">{theme.theme_name}</span>
                </motion.div>

                {/* 进入提示 - 悬停显示（仅解锁时） */}
                {!isLocked && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ opacity: 1, scale: 1 }}
                    className="absolute bottom-4 right-4 px-5 py-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full font-bold shadow-lg transform rotate-2"
                  >
                    点击进入 →
                  </motion.div>
                )}
              </div>

              {/* 信息区 */}
              <div className={`p-5 bg-gradient-to-br from-white to-gray-50 ${isLocked ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">🎨 画笔颜色</span>
                    <div className="flex gap-2">
                      {theme.palette.slice(0, 5).map((color, i) => (
                        <motion.div
                          key={color}
                          whileHover={isLocked ? {} : { scale: 1.4, rotate: 360 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                          className={`w-7 h-7 rounded-full border-3 border-white shadow-md ${isLocked ? '' : 'hover-bounce cursor-pointer'}`}
                          style={{
                            backgroundColor: isLocked ? '#9CA3AF' : color,
                            boxShadow: isLocked ? 'none' : `0 2px 8px ${color}40`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {/* <motion.div
                    whileHover={isLocked ? {} : { scale: 1.1 }}
                    className={`px-3 py-1 rounded-full text-xs font-bold border-2 transform rotate-2 ${isLocked ? 'bg-gray-100 text-gray-500 border-gray-300' : 'bg-purple-100 text-purple-700 border-purple-300'}`}
                  >
                    {theme.ai_settings.keywords.length} 种物体
                  </motion.div> */}
                </div>
              </div>

              {/* 悬停光晕效果（仅解锁时） */}
              {!isLocked && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                </div>
              )}
            </motion.button>
          )
        })}
      </motion.div>

      {/* 版本信息 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="mt-8 relative z-10"
      >
        <p className="text-sm text-gray-500 text-center font-sketch">
          v0.1.0 · 儿童画风格涂鸦对抗游戏 🎨
        </p>
      </motion.div>
    </main>
  )
}
