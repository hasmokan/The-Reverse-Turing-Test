'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { themes } from '@/config/themes'
import { useGameStore } from '@/lib/store'

export default function LobbyPage() {
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
    <main className="min-h-screen p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* 标题 */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-gray-800 font-sketch mb-2">
          🎭 谁是AI卧底
        </h1>
        <p className="text-gray-600">
          画出你的涂鸦，找出混入的 AI！
        </p>
      </motion.div>

      {/* 房间列表 */}
      <div className="max-w-md mx-auto space-y-4">
        <h2 className="text-lg font-bold text-gray-700 mb-4">选择主题房间</h2>

        {Object.values(themes).map((theme, index) => (
          <motion.div
            key={theme.theme_id}
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <button
              onClick={() => handleSelectRoom(theme.theme_id)}
              className="w-full bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group"
            >
              {/* 预览图 */}
              <div
                className="h-32 bg-cover bg-center relative"
                style={{
                  backgroundImage: `url(${theme.assets.background_url})`,
                }}
              >
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                {/* 主题标签 */}
                <div className="absolute top-3 left-3 px-3 py-1 bg-white/90 rounded-full text-sm font-medium">
                  {theme.theme_id === 'fish_tank_01' ? '🐠' : '☕'} {theme.theme_name}
                </div>
              </div>

              {/* 信息区 */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">可用颜色：</span>
                    <div className="flex gap-1">
                      {theme.palette.slice(0, 5).map((color) => (
                        <div
                          key={color}
                          className="w-5 h-5 rounded-full border border-gray-200"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <motion.span
                    whileHover={{ x: 5 }}
                    className="text-blue-500 font-medium"
                  >
                    进入 →
                  </motion.span>
                </div>
              </div>
            </button>
          </motion.div>
        ))}
      </div>

      {/* 游戏说明 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-md mx-auto mt-8 p-4 bg-white/60 rounded-2xl"
      >
        <h3 className="font-bold text-gray-700 mb-2">🎮 游戏规则</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>1. 在画板上随意涂鸦，提交你的作品</li>
          <li>2. AI 会定期混入模仿人类的画作</li>
          <li>3. 观察场景中的物体，找出可疑的 AI</li>
          <li>4. 发起投票，成功淘汰 AI 可获得积分</li>
          <li>5. 如果 AI 数量超过 5 个，游戏结束！</li>
        </ul>
      </motion.div>

      {/* 底部说明 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center text-sm text-gray-400 mt-8"
      >
        Project Mimic v0.1 - 儿童画风格涂鸦对抗游戏
      </motion.p>
    </main>
  )
}
