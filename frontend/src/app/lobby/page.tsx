'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/lib/store'
import {
  getThemes,
  getOrCreateRoom,
  getRoom,
  convertThemeResponse,
  ThemeResponse,
} from '@/lib/api'

export default function LobbyPage() {
  const router = useRouter()
  const setTheme = useGameStore((state) => state.setTheme)
  const setRoomId = useGameStore((state) => state.setRoomId)
  const setPhase = useGameStore((state) => state.setPhase)
  const syncState = useGameStore((state) => state.syncState)

  const [themes, setThemes] = useState<ThemeResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joiningRoom, setJoiningRoom] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [showJoinInput, setShowJoinInput] = useState(false)

  // 加载主题列表
  useEffect(() => {
    async function loadThemes() {
      try {
        setLoading(true)
        const data = await getThemes()
        setThemes(data)
        setError(null)
      } catch (err) {
        console.error('Failed to load themes:', err)
        setError('无法连接到服务器，请检查网络')
      } finally {
        setLoading(false)
      }
    }
    loadThemes()
  }, [])

  // 加入或创建房间（先查询活跃房间，没有则创建）
  const handleCreateRoom = async (themeId: string) => {
    try {
      setJoiningRoom(themeId)
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
      setJoiningRoom(null)
    }
  }

  // 加入房间
  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return

    try {
      setJoiningRoom('joining')
      const { room, theme } = await getRoom(joinCode.toUpperCase())

      // 设置游戏状态
      setTheme(convertThemeResponse(theme))
      setRoomId(room.roomId)
      setPhase('viewing')
      syncState({
        totalItems: room.totalItems,
        aiCount: room.aiCount,
        turbidity: room.turbidity,
      })

      router.push('/game')
    } catch (err) {
      console.error('Failed to join room:', err)
      setError('房间不存在或已关闭')
      setJoiningRoom(null)
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

      {/* 错误提示 */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center"
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

      {/* 加入房间 */}
      <div className="max-w-md mx-auto mb-6">
        {showJoinInput ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white rounded-2xl shadow-lg p-4"
          >
            <h3 className="font-bold text-gray-700 mb-3">🔗 输入房间码</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="例如: ABC123"
                maxLength={6}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none text-center text-xl font-mono tracking-widest uppercase"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoinRoom}
                disabled={joiningRoom === 'joining' || joinCode.length < 6}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold disabled:opacity-50"
              >
                {joiningRoom === 'joining' ? '加入中...' : '加入'}
              </motion.button>
            </div>
            <button
              onClick={() => setShowJoinInput(false)}
              className="mt-2 text-gray-500 text-sm hover:text-gray-700"
            >
              取消
            </button>
          </motion.div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowJoinInput(true)}
            className="w-full py-4 bg-white rounded-2xl shadow-lg text-gray-700 font-bold hover:shadow-xl transition-shadow"
          >
            🔗 输入房间码加入
          </motion.button>
        )}
      </div>

      {/* 房间列表 */}
      <div className="max-w-md mx-auto space-y-4">
        <h2 className="text-lg font-bold text-gray-700 mb-4">选择主题加入房间</h2>

        {loading ? (
          <div className="text-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="inline-block text-4xl"
            >
              🎨
            </motion.div>
            <p className="text-gray-500 mt-2">加载主题中...</p>
          </div>
        ) : themes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无可用主题
          </div>
        ) : (
          themes.map((theme, index) => (
            <motion.div
              key={theme.themeId}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <button
                onClick={() => handleCreateRoom(theme.themeId)}
                disabled={joiningRoom !== null}
                className="w-full bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group disabled:opacity-70"
              >
                {/* 预览图 */}
                <div
                  className="h-32 bg-cover bg-center relative"
                  style={{
                    backgroundImage: `url(${theme.backgroundUrl})`,
                    backgroundColor: theme.palette[0] || '#f0f0f0',
                  }}
                >
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                  {/* 主题标签 */}
                  <div className="absolute top-3 left-3 px-3 py-1 bg-white/90 rounded-full text-sm font-medium">
                    {theme.themeId === 'fish_tank_01' ? '🐠' : '☕'} {theme.themeName}
                  </div>

                  {/* 加载指示器 */}
                  {joiningRoom === theme.themeId && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="text-3xl"
                      >
                        🎨
                      </motion.div>
                    </div>
                  )}
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
                      加入房间 →
                    </motion.span>
                  </div>
                </div>
              </button>
            </motion.div>
          ))
        )}
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
