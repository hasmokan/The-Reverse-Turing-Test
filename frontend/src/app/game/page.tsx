'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { GameItem, Comment } from '@/types'
import DrawingCanvas, { type DrawingCanvasRef } from '@/components/canvas/DrawingCanvas'
import GameStage from '@/components/stage/GameStage'
import GameHeader from '@/components/ui/GameHeader'
import SubmitForm from '@/components/ui/SubmitForm'
import { ItemDetailModal, VotingTimer } from '@/components/voting/ItemDetailModal'

export default function GamePage() {
  const phase = useGameStore((state) => state.phase)
  const setPhase = useGameStore((state) => state.setPhase)
  const addItem = useGameStore((state) => state.addItem)
  const castVote = useGameStore((state) => state.castVote)
  const startVoting = useGameStore((state) => state.startVoting)
  const resetGame = useGameStore((state) => state.resetGame)
  const addComment = useGameStore((state) => state.addComment)

  const canvasRef = useRef<DrawingCanvasRef>(null)
  const [showDrawing, setShowDrawing] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<GameItem | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)

  // 处理提交作品
  const handleSubmit = (name: string, description: string) => {
    if (!pendingImage) return

    addItem({
      imageUrl: pendingImage,
      name,
      description,
      author: '匿名艺术家',
      isAI: false,
      createdAt: Date.now(),
    })

    setPendingImage(null)
    setShowDrawing(false)
    setPhase('viewing')
  }

  // 处理点击物体
  const handleItemClick = (item: GameItem) => {
    setSelectedItem(item)
    setShowItemModal(true)
  }

  // 处理投票
  const handleVote = (itemId: string) => {
    castVote(itemId)
    setShowItemModal(false)
  }

  // 处理评论
  const handleComment = (itemId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => {
    addComment(itemId, comment)
  }

  // 完成绘画 - 从画布导出真实图片
  const handleFinishDrawing = () => {
    const imageUrl = canvasRef.current?.exportImage()
    if (imageUrl) {
      setPendingImage(imageUrl)
    }
  }

  return (
    <main className="h-screen flex flex-col p-4 safe-area-inset bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-100 crayon-texture">
      {/* 投票倒计时 */}
      <VotingTimer />

      {/* 顶部状态栏 */}
      <GameHeader />

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
                whileHover={{ scale: 1.08, rotate: 2 }}
                whileTap={{ scale: 0.92, rotate: -2 }}
                onClick={handleFinishDrawing}
                className="absolute bottom-4 right-4 px-8 py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-full font-bold text-lg shadow-2xl hand-drawn-button border-green-600"
              >
                完成 ✓
              </motion.button>

              {/* 返回按钮 */}
              <motion.button
                whileHover={{ scale: 1.05, rotate: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDrawing(false)}
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
      {!showDrawing && phase !== 'gameover' && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-4 flex gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.05, rotate: -1 }}
            whileTap={{ scale: 0.95, rotate: 1 }}
            onClick={() => setShowDrawing(true)}
            className="flex-1 py-5 rainbow-gradient text-white rounded-3xl font-bold text-xl shadow-2xl hand-drawn-button border-pink-500 relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              🎨 画一个！
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

          {/* 开发模式：添加测试 AI */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              addItem({
                imageUrl: `data:image/svg+xml,${encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                    <ellipse cx="50" cy="50" rx="35" ry="25" fill="#FF6B6B" stroke="#333" stroke-width="3"/>
                    <polygon points="85,50 100,35 100,65" fill="#FF6B6B" stroke="#333" stroke-width="3"/>
                    <circle cx="35" cy="45" r="5" fill="#333"/>
                  </svg>
                `)}`,
                name: 'AI小鱼',
                description: '我是一条普通的鱼',
                author: '匿名艺术家',
                isAI: true,
                createdAt: Date.now(),
              })
            }}
            className="px-5 py-5 bg-gradient-to-br from-blue-200 to-purple-200 text-gray-700 rounded-3xl font-bold text-2xl shadow-lg hand-drawn-button border-purple-400"
          >
            🤖
          </motion.button>

          {/* 测试投票 */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: -10 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const items = useGameStore.getState().items
              if (items.length > 0) {
                startVoting(items[0])
              }
            }}
            className="px-5 py-5 bg-gradient-to-br from-orange-200 to-red-200 text-orange-700 rounded-3xl font-bold text-2xl shadow-lg hand-drawn-button border-orange-400"
          >
            🗳️
          </motion.button>
        </motion.div>
      )}

      {/* Game Over 重置按钮 */}
      {phase === 'gameover' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <motion.button
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95, rotate: 2 }}
            onClick={resetGame}
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
      />
    </main>
  )
}
