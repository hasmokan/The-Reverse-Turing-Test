'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useGameStore } from '@/lib/store'
import { GameItem } from '@/types'

interface ItemDetailModalProps {
  item: GameItem | null
  isOpen: boolean
  onClose: () => void
  onVote: (itemId: string) => void
}

export function ItemDetailModal({ item, isOpen, onClose, onVote }: ItemDetailModalProps) {
  const phase = useGameStore((state) => state.phase)
  const votes = useGameStore((state) => state.votes)
  const votingTarget = useGameStore((state) => state.votingTarget)

  if (!item) return null

  const isVotingPhase = phase === 'voting'
  const isVotingTarget = votingTarget?.id === item.id
  const currentVotes = votes[item.id] || 0

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 图片展示区 */}
            <div className="relative bg-gradient-to-br from-blue-100 to-purple-100 p-8">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-48 h-48 object-contain mx-auto drop-shadow-lg"
                />
              </motion.div>
            </div>

            {/* 信息区 */}
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-800 text-center font-sketch">
                {item.name}
              </h3>

              <p className="text-gray-600 text-center mt-2 font-sketch">
                "{item.description}"
              </p>

              <div className="mt-4 text-center text-sm text-gray-400">
                创作者：{item.author}
              </div>

              {/* 投票按钮区 */}
              {isVotingPhase && (
                <div className="mt-6">
                  {isVotingTarget && (
                    <div className="text-center mb-3 text-sm text-orange-500 font-medium">
                      当前票数：{currentVotes}
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onVote(item.id)}
                    className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-shadow"
                  >
                    🚨 它是假的！
                  </motion.button>
                </div>
              )}

              {/* 非投票阶段的举报按钮 */}
              {!isVotingPhase && (
                <div className="mt-6 flex gap-3">
                  <button className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                    ⚠️ 举报
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
                  >
                    关闭
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// 投票倒计时组件
export function VotingTimer() {
  const [timeLeft, setTimeLeft] = useState(60)
  const votingEndTime = useGameStore((state) => state.votingEndTime)
  const phase = useGameStore((state) => state.phase)
  const endVoting = useGameStore((state) => state.endVoting)

  useEffect(() => {
    if (phase !== 'voting' || !votingEndTime) return

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((votingEndTime - Date.now()) / 1000))
      setTimeLeft(remaining)

      if (remaining <= 0) {
        endVoting()
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [phase, votingEndTime, endVoting])

  if (phase !== 'voting') return null

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg"
    >
      <div className="flex items-center gap-3">
        <span className="animate-pulse">🔍</span>
        <span className="font-bold">投票中</span>
        <span className="bg-white/20 px-3 py-1 rounded-full font-mono">
          {timeLeft}s
        </span>
      </div>
    </motion.div>
  )
}

export default ItemDetailModal
