'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { GameItem, Comment } from '@/types'
import DrawingCanvas, { type DrawingCanvasRef } from '@/components/canvas/DrawingCanvas'
import GameStage from '@/components/stage/GameStage'
import GameHeader from '@/components/ui/GameHeader'
import SubmitForm from '@/components/ui/SubmitForm'
import { ItemDetailModal, VotingTimer } from '@/components/voting/ItemDetailModal'
import {
  createDrawing,
  ensureGuestAuth,
  voteDrawing,
  getOrCreateSessionId,
} from '@/lib/api'
import useWebSocket from '@/hooks/useWebSocket'
import { useBattleSystem } from '@/hooks/useBattleSystem'
import { useDebounceCallback } from '@/hooks/useDebounce'

// 战斗系统组件
import { ToastContainer, AttackWarning } from '@/components/feedback'
import { CooldownHUD } from '@/components/hud'
import { FloatingDamageLayer } from '@/components/effects'
import { VictoryScreen, DefeatScreen } from '@/components/result'

// 随机作者名字列表
const RANDOM_AUTHOR_NAMES = [
  '小明', '阿强', '花花', '大毛', '翠花',
  '老王', '小李', '阿珍', '铁柱', '建国',
  '美丽', '胖虎', '小新', '大雄', '静香',
  '小红', '阿华', '小刚', '丽丽', '小芳'
]

// 无厘头加载提示（炉石传说风格）
const LOADING_TIPS = [
  '全球的鱼正在涌来...',
  'AI 正在披上伪装...',
  '正在给鱼缸换水...',
  '间谍鱼正在学习伪装术...',
  '正在数鱼的鳞片...',
  '正在教鱼吐泡泡...',
  '正在调整水温至最佳摸鱼温度...',
  '正在给每条鱼取小名...',
  '正在训练 AI 假装游泳...',
  '正在往鱼缸里加入神秘海盐...',
  '正在检查有没有鱼在摸鱼...',
  '正在让鱼排队入场...',
  '正在给间谍鱼发工资...',
  '正在校准鱼的智商检测仪...',
  '正在用放大镜找可疑的鱼...',
  '正在播放鱼喜欢的音乐...',
  '正在给鱼缸里扔面包屑...',
  '正在统计谁是最可疑的鱼...',
]

const getRandomAuthorName = () => {
  return RANDOM_AUTHOR_NAMES[Math.floor(Math.random() * RANDOM_AUTHOR_NAMES.length)]
}

export default function GamePage() {
  const router = useRouter()
  const phase = useGameStore((state) => state.phase)
  const roomId = useGameStore((state) => state.roomId)
  const isSynced = useGameStore((state) => state.isSynced)
  const setPhase = useGameStore((state) => state.setPhase)
  const addItem = useGameStore((state) => state.addItem)
  const castVote = useGameStore((state) => state.castVote)
  const startVoting = useGameStore((state) => state.startVoting)
  const resetGame = useGameStore((state) => state.resetGame)
  const addComment = useGameStore((state) => state.addComment)
  const gameResult = useGameStore((state) => state.gameResult)
  const setPlayerId = useGameStore((state) => state.setPlayerId)
  const setPlayerFishId = useGameStore((state) => state.setPlayerFishId)
  const showToast = useGameStore((state) => state.showToast)

  const canvasRef = useRef<DrawingCanvasRef>(null)
  const [showDrawing, setShowDrawing] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [authToken, setAuthToken] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false) // 导出图片 loading 状态
  // 使用固定初始值避免 SSR/CSR hydration 不匹配
  const [loadingTip, setLoadingTip] = useState(LOADING_TIPS[0]) // 加载提示轮播

  // 加载提示轮播效果
  useEffect(() => {
    if (isSynced) return // 同步完成后停止轮播

    // 初始化时立即随机选择一条（客户端）
    setLoadingTip(LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)])

    const interval = setInterval(() => {
      setLoadingTip(LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)])
    }, 2500) // 每 2.5 秒切换一次

    return () => clearInterval(interval)
  }, [isSynced])

  // 初始化 session ID + 游客身份
  useEffect(() => {
    let cancelled = false

    const initIdentity = async () => {
      const id = getOrCreateSessionId()
      if (cancelled) return
      setSessionId(id)

      try {
        const auth = await ensureGuestAuth(id)
        if (cancelled) return
        setAuthToken(auth.token)
        setPlayerId(auth.userId)
      } catch (err) {
        console.error('Failed to initialize guest auth:', err)
      }
    }

    initIdentity()

    return () => {
      cancelled = true
    }
  }, [setPlayerId])

  // 刷新页面时，如果没有 roomId，重定向到首页
  useEffect(() => {
    if (!roomId) {
      router.replace('/')
    }
  }, [roomId, router])

  // 连接 WebSocket
  const { submitComment, emit, battleVote, retractVote, chaseVote } = useWebSocket({
    roomId: roomId || '',
    authToken,
    enabled: !!roomId && !!authToken,
  })

  // 战斗系统
  const battleSystem = useBattleSystem({ emit })

  // 处理提交作品
  const handleSubmit = async (name: string, description: string) => {
    if (!pendingImage || !roomId) return

    try {
      setSubmitting(true)

      // 调用后端 API 提交绘画
      const drawing = await createDrawing(roomId, {
        image_data: pendingImage,
        name,
        description,
        session_id: sessionId,
        author_name: getRandomAuthorName(),
      })

      // 添加到本地 store（保留后端返回的 UUID）
      addItem({
        id: drawing.id,
        imageUrl: drawing.imageUrl,
        name: drawing.name,
        description: drawing.description || '',
        author: drawing.author,
        isAI: false,
        createdAt: new Date(drawing.createdAt).getTime(),
      })

      // 设置玩家自己的鱼的 ID（用于判断被攻击）
      setPlayerFishId(drawing.id)

      setPendingImage(null)
      setShowDrawing(false)
      setPhase('viewing')
    } catch (err) {
      console.error('Failed to submit drawing:', err)
      alert('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 处理点击物体
  const handleItemClick = (item: GameItem) => {
    setSelectedItem(item)
    setShowItemModal(true)
  }

  // 处理投票
  const handleVote = async (itemId: string) => {
    try {
      // 调用后端 API 投票
      const result = await voteDrawing(itemId, sessionId)

      // 更新本地状态
      castVote(itemId)

      // 如果被淘汰，显示提示
      if (result.eliminated) {
        alert('投票成功！该作品已被淘汰')
      }
    } catch (err) {
      console.error('Failed to vote:', err)
      // 可能是已经投过票
      alert('投票失败，可能你已经投过票了')
    }
    setShowItemModal(false)
  }

  // 处理战斗操作
  const handleBattleAction = (fishId: string, position?: { x: number; y: number }) => {
    const result = battleSystem.executeAction(fishId, position)
    if (result) {
      // 关闭弹窗
      setShowItemModal(false)
    }
    return result
  }

  // 处理评论
  const handleComment = (itemId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => {
    // 本地添加评论
    addComment(itemId, comment)
    // 通过 WebSocket 广播
    submitComment(itemId, comment)
  }

  // 完成绘画 - 从画布导出真实图片（带防抖和 loading）
  const handleFinishDrawing = async () => {
    // 防抖：如果正在导出，忽略点击
    if (isExporting) return

    setIsExporting(true)

    // 延迟一点让 UI 更新
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const imageUrl = canvasRef.current?.exportImage()
      if (imageUrl) {
        setPendingImage(imageUrl)
      } else {
        // 画布为空，使用 Toast 提示用户
        showToast('info', '🎨 画布是空的哦！请先画点东西再提交~')
      }
    } finally {
      setIsExporting(false)
    }
  }

  // 复制房间码
  const copyRoomCode = useCallback(() => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
      alert(`房间码已复制: ${roomId}`)
    }
  }, [roomId])

  // 防抖处理的回调函数
  const debouncedCopyRoomCode = useDebounceCallback(copyRoomCode, 300)
  const debouncedShowDrawing = useDebounceCallback(() => setShowDrawing(true), 300)
  const debouncedHideDrawing = useDebounceCallback(() => setShowDrawing(false), 300)
  const debouncedResetGame = useDebounceCallback(resetGame, 300)

  // 判断是否显示游戏结束界面（由 VictoryScreen/DefeatScreen 处理）
  const showGameOverOverlay = gameResult !== null

  return (
    <main className="h-screen flex flex-col p-4 safe-area-inset bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-100 crayon-texture">
      {/* ==================== 战斗系统全局组件 ==================== */}

      {/* Toast 通知容器 */}
      <ToastContainer />

      {/* 攻击警告（屏幕边缘泛红） */}
      <AttackWarning />

      {/* 漂浮伤害数字 */}
      <FloatingDamageLayer />

      {/* 胜利界面 */}
      <VictoryScreen />

      {/* 失败界面 */}
      <DefeatScreen />

      {/* CD 倒计时 HUD - 绘画面板打开时隐藏 */}
      {!showDrawing && <CooldownHUD />}

      {/* ==================== 原有组件 ==================== */}

      {/* 投票倒计时 */}
      <VotingTimer />

      {/* 房间码显示 */}
      {roomId && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 right-4 z-10"
        >
          <button
            onClick={debouncedCopyRoomCode}
            className="px-3 py-1 bg-white/80 rounded-full text-sm font-mono shadow-md hover:bg-white transition-colors"
          >
            🔗 {roomId}
          </button>
        </motion.div>
      )}

      {/* 顶部状态栏 */}
      <GameHeader />

      {/* 加载进度条 - 首次进入房间同步状态时显示 */}
      <AnimatePresence>
        {!isSynced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-gradient-to-br from-blue-100/95 via-purple-100/95 to-pink-100/95 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="text-center"
            >
              {/* 鱼缸图标 */}
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotate: [-5, 5, -5],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="text-8xl mb-6"
              >
                🐠
              </motion.div>

              {/* 加载文字轮播 */}
              <AnimatePresence mode="wait">
                <motion.h2
                  key={loadingTip}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-xl font-bold text-purple-600 font-sketch mb-4 h-8"
                >
                  {loadingTip}
                </motion.h2>
              </AnimatePresence>

              {/* 进度条 */}
              <div className="w-64 h-3 bg-white/50 rounded-full overflow-hidden border-2 border-purple-300 shadow-inner">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
                  className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full"
                />
              </div>

              {/* 提示文字 */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-gray-500 text-sm mt-4"
              >
                正在同步鱼缸数据，请稍候...
              </motion.p>

              {/* 装饰气泡 */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: '100%', x: `${15 + i * 15}%`, opacity: 0 }}
                    animate={{
                      y: '-100%',
                      opacity: [0, 0.6, 0],
                    }}
                    transition={{
                      duration: 3 + i * 0.5,
                      repeat: Infinity,
                      delay: i * 0.3,
                      ease: 'easeOut',
                    }}
                    className="absolute w-4 h-4 bg-blue-200 rounded-full"
                    style={{ filter: 'blur(1px)' }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主游戏区域 */}
      <div className="flex-1 mt-4 relative">
        <AnimatePresence mode="wait">
          {showDrawing ? (
            <motion.div
              key="canvas"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="h-full"
            >
              <DrawingCanvas ref={canvasRef} />

              {/* 完成按钮 */}
              <motion.button
                whileHover={!isExporting ? { scale: 1.08, rotate: 2 } : {}}
                whileTap={!isExporting ? { scale: 0.92, rotate: -2 } : {}}
                onClick={handleFinishDrawing}
                disabled={isExporting}
                className={`absolute bottom-4 right-16 px-8 py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full font-bold text-lg shadow-2xl hand-drawn-button border-green-600 flex items-center gap-2 ${isExporting ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
              >
                {isExporting ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block"
                    >
                      ⏳
                    </motion.span>
                    处理中...
                  </>
                ) : (
                  <>完成 ✓</>
                )}
              </motion.button>

              {/* 返回按钮 */}
              <motion.button
                whileHover={{ scale: 1.05, rotate: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={debouncedHideDrawing}
                className="absolute bottom-4 left-4 px-8 py-4 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-full font-bold shadow-xl hand-drawn-button border-gray-600"
              >
                ← 返回
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="stage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <GameStage onItemClick={handleItemClick} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部操作区 */}
      {!showDrawing && phase !== 'gameover' && !showGameOverOverlay && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-4 flex gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.05, rotate: -1 }}
            whileTap={{ scale: 0.95, rotate: 1 }}
            onClick={debouncedShowDrawing}
            className="flex-1 py-5 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white rounded-3xl font-bold text-xl shadow-2xl hand-drawn-button border-red-600 relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 font-extrabold">
              🎨 先画一条自己的鱼！
            </span>
            {/* 悬停星星效果 */}
            <motion.div
              className="absolute top-2 right-2 text-2xl"
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✨
            </motion.div>
          </motion.button>
        </motion.div>
      )}

      {/* Game Over 重置按钮（仅在没有 gameResult 时显示） */}
      {phase === 'gameover' && !showGameOverOverlay && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <motion.button
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95, rotate: 2 }}
            onClick={debouncedResetGame}
            className="w-full py-5 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-3xl font-bold text-xl shadow-2xl hand-drawn-button border-green-600 relative overflow-hidden"
          >
            <span className="relative z-10">🔄 重新开始</span>
            {/* 闪烁效果 */}
            <motion.div
              className="absolute inset-0 bg-white"
              animate={{ opacity: [0, 0.3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.button>
        </motion.div>
      )}

      {/* 提交表单 */}
      <AnimatePresence>
        {pendingImage && (
          <SubmitForm
            imageUrl={pendingImage}
            onSubmit={handleSubmit}
            onCancel={() => setPendingImage(null)}
            disabled={submitting}
          />
        )}
      </AnimatePresence>

      {/* 物品详情弹窗 */}
      <ItemDetailModal
        item={selectedItem}
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        onVote={handleVote}
        onComment={handleComment}
        onBattleAction={handleBattleAction}
        wsEmit={emit}
      />
    </main>
  )
}
