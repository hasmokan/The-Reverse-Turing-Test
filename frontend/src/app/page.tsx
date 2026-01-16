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
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100">
      {/* Logo 和标题 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="text-center mb-10"
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="text-8xl mb-4"
        >
          🎭
        </motion.div>
        <h1 className="text-5xl font-bold text-gray-800 font-sketch mb-3">
          谁是AI卧底
        </h1>
        <p className="text-xl text-gray-600 font-sketch">
          Project Mimic
        </p>
        <p className="text-sm text-gray-400 mt-2">
          画出涂鸦，找出混入的 AI！
        </p>
      </motion.div>

      {/* 房间选择卡片 */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-md space-y-4"
      >
        <h2 className="text-lg font-bold text-gray-700 text-center mb-4">🚀 选择主题房间</h2>

        {Object.values(themes).map((theme, index) => (
          <motion.button
            key={theme.theme_id}
            initial={{ x: index % 2 === 0 ? -30 : 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelectRoom(theme.theme_id)}
            className="w-full bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all group"
          >
            {/* 预览图 */}
            <div
              className="h-36 bg-cover bg-center relative"
              style={{
                backgroundImage: `url(${theme.assets.background_url})`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

              {/* 主题标签 */}
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="absolute top-4 left-4 px-4 py-2 bg-white/95 rounded-full text-lg font-bold shadow-md"
              >
                {theme.theme_id === 'fish_tank_01' ? '🐠' : '☕'} {theme.theme_name}
              </motion.div>

              {/* 进入提示 */}
              <div className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 rounded-full text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                点击进入 →
              </div>
            </div>

            {/* 信息区 */}
            <div className="p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">画笔颜色：</span>
                  <div className="flex gap-1.5">
                    {theme.palette.slice(0, 5).map((color) => (
                      <motion.div
                        key={color}
                        whileHover={{ scale: 1.3 }}
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {theme.ai_settings.keywords.length} 种物体
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* 游戏说明 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="max-w-md mt-10 p-5 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg"
      >
        <h3 className="font-bold text-gray-700 mb-3 text-center">🎮 游戏玩法</h3>
        <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <span>随意涂鸦创作</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span>AI 会混入画作</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <span>找出可疑作品</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🗳️</span>
            <span>投票淘汰 AI</span>
          </div>
        </div>
        <p className="text-xs text-center text-red-400 mt-3">
          ⚠️ AI 数量超过 5 个则游戏结束！
        </p>
      </motion.div>

      {/* 版本信息 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-sm text-gray-400 mt-8"
      >
        v0.1.0 · 儿童画风格涂鸦对抗游戏
      </motion.p>
    </main>
  )
}
