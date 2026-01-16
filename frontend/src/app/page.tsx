'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { themes } from '@/config/themes'
import { useGameStore } from '@/lib/store'

export default function HomePage() {
  const router = useRouter()
  const setTheme = useGameStore((state) => state.setTheme)
  const setRoomId = useGameStore((state) => state.setRoomId)
  const setPhase = useGameStore((state) => state.setPhase)

  const handleSelectRoom = (themeId: string) => {
    const theme = themes[themeId]
    if (theme) {
      setTheme(theme)
      setRoomId(themeId)
      setPhase('viewing')
      router.push('/game')
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
        className="text-center mb-10 relative z-10"
      >
        <motion.div
          animate={{
            rotate: [0, -8, 8, -5, 5, 0],
            scale: [1, 1.1, 1, 1.05, 1]
          }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="text-9xl mb-6 filter drop-shadow-2xl"
        >
          🎭
        </motion.div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 font-sketch mb-4 transform -rotate-1"
          style={{
            textShadow: '3px 3px 0px rgba(255,182,193,0.5), -2px -2px 0px rgba(135,206,250,0.3)'
          }}
        >
          谁是AI卧底
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl text-pink-600 font-sketch transform rotate-1 mb-2"
        >
          Project Mimic
        </motion.p>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
          className="inline-block px-6 py-2 bg-yellow-300 border-3 border-yellow-600 rounded-full transform -rotate-2 shadow-lg"
        >
          <p className="text-sm text-yellow-900 font-bold">
            🎨 画出涂鸦，找出混入的 AI！
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
        <motion.h2
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 text-center mb-6 font-sketch transform -rotate-1"
        >
          🚀 选择主题房间
        </motion.h2>

        {Object.values(themes).map((theme, index) => (
          <motion.button
            key={theme.theme_id}
            initial={{ x: index % 2 === 0 ? -50 : 50, opacity: 0, rotate: index % 2 === 0 ? -5 : 5 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.4 + index * 0.15, type: 'spring', stiffness: 100 }}
            whileHover={{
              scale: 1.05,
              rotate: index % 2 === 0 ? 2 : -2,
              transition: { duration: 0.3 }
            }}
            whileTap={{ scale: 0.95, rotate: 0 }}
            onClick={() => handleSelectRoom(theme.theme_id)}
            className="w-full scribble-card overflow-hidden group relative"
            style={{
              borderColor: theme.palette[0] || '#FF6B9D'
            }}
          >
            {/* 预览图 */}
            <div
              className="h-40 bg-cover bg-center relative overflow-hidden"
              style={{
                backgroundImage: `url(${theme.assets.background_url})`,
              }}
            >
              {/* 渐变遮罩 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

              {/* 星星装饰 */}
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute top-3 right-3 text-2xl"
              >
                ✨
              </motion.div>

              {/* 主题标签 */}
              <motion.div
                whileHover={{ scale: 1.1, rotate: -3 }}
                className="absolute top-4 left-4 px-5 py-2 bg-white/95 hand-drawn-border border-2 text-lg font-bold shadow-xl transform -rotate-2"
                style={{
                  borderColor: theme.palette[1] || '#FFA06B'
                }}
              >
                <span className="mr-2">{theme.theme_id === 'fish_tank_01' ? '🐠' : '☕'}</span>
                <span className="text-gray-800">{theme.theme_name}</span>
              </motion.div>

              {/* 进入提示 - 悬停显示 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileHover={{ opacity: 1, scale: 1 }}
                className="absolute bottom-4 right-4 px-5 py-2 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full font-bold shadow-lg transform rotate-2"
              >
                点击进入 →
              </motion.div>
            </div>

            {/* 信息区 */}
            <div className="p-5 bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">🎨 画笔颜色</span>
                  <div className="flex gap-2">
                    {theme.palette.slice(0, 5).map((color, i) => (
                      <motion.div
                        key={color}
                        whileHover={{ scale: 1.4, rotate: 360 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                        className="w-7 h-7 rounded-full border-3 border-white shadow-md hover-bounce cursor-pointer"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 2px 8px ${color}40`
                        }}
                      />
                    ))}
                  </div>
                </div>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border-2 border-purple-300 transform rotate-2"
                >
                  {theme.ai_settings.keywords.length} 种物体
                </motion.div>
              </div>
            </div>

            {/* 悬停光晕效果 */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* 游戏说明 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="max-w-md mt-8 p-6 scribble-card relative z-10 bg-gradient-to-br from-blue-50 to-purple-50"
        style={{ borderColor: '#A78BFA' }}
      >
        <motion.h3
          whileHover={{ scale: 1.05, rotate: -2 }}
          className="font-bold text-xl text-purple-700 mb-4 text-center font-sketch transform -rotate-1"
        >
          🎮 游戏玩法
        </motion.h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { icon: '🎨', text: '随意涂鸦创作', delay: 0 },
            { icon: '🤖', text: 'AI 会混入画作', delay: 0.1 },
            { icon: '🔍', text: '找出可疑作品', delay: 0.2 },
            { icon: '🗳️', text: '投票淘汰 AI', delay: 0.3 }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9 + item.delay }}
              whileHover={{ scale: 1.1, rotate: i % 2 === 0 ? -5 : 5 }}
              className="flex items-center gap-2 p-3 bg-white/80 rounded-2xl shadow-sm hand-drawn-border border-2 border-purple-300 hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="font-medium text-gray-700">{item.text}</span>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          whileHover={{ scale: 1.05 }}
          className="mt-4 p-3 bg-red-100 border-2 border-red-400 rounded-xl text-center transform rotate-1"
        >
          <p className="text-sm text-red-700 font-bold">
            ⚠️ AI 数量超过 5 个则游戏结束！
          </p>
        </motion.div>
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
