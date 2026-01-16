'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { GameItem } from '@/types'
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

  // 完成绘画 - 从画布导出真实图片
  const handleFinishDrawing = () => {
    const imageUrl = canvasRef.current?.exportImage()
    if (imageUrl) {
      setPendingImage(imageUrl)
    }
  }

  return (
    <main className="h-screen flex flex-col p-4 safe-area-inset">
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
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleFinishDrawing}
                className="absolute bottom-4 right-4 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-bold shadow-lg"
              >
                完成 ✓
              </motion.button>

              {/* 返回按钮 */}
              <button
                onClick={() => setShowDrawing(false)}
                className="absolute bottom-4 left-4 px-6 py-3 bg-gray-500 text-white rounded-full font-medium shadow-lg"
              >
                ← 返回
              </button>
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowDrawing(true)}
            className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl font-bold text-lg shadow-lg"
          >
            🎨 画一个！
          </motion.button>

          {/* 开发模式：添加测试 AI */}
          <button
            onClick={() => {
              const testAI: Omit<GameItem, 'id' | 'position' | 'velocity' | 'rotation' | 'scale' | 'flipX'> = {
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
              }
              addItem(testAI)
            }}
            className="px-4 py-4 bg-gray-200 text-gray-600 rounded-2xl font-medium"
          >
            🤖
          </button>

          {/* 测试投票 */}
          <button
            onClick={() => {
              const items = useGameStore.getState().items
              if (items.length > 0) {
                startVoting(items[0])
              }
            }}
            className="px-4 py-4 bg-orange-200 text-orange-600 rounded-2xl font-medium"
          >
            🗳️
          </button>
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={resetGame}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-bold text-lg shadow-lg"
          >
            🔄 重新开始
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
      />
    </main>
  )
}
