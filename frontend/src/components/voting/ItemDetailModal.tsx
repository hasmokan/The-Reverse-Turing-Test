'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { GameItem, Comment, WSEventType } from '@/types'
import { useBattleSystem } from '@/hooks/useBattleSystem'
import { useDebounceCallback } from '@/hooks/useDebounce'
import { ELIMINATION_THRESHOLD } from '@/lib/battleConstants'

interface ItemDetailModalProps {
  item: GameItem | null
  isOpen: boolean
  onClose: () => void
  onVote: (itemId: string) => void
  onComment?: (itemId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => void
  // 战斗系统 props
  onBattleAction?: (fishId: string, position?: { x: number; y: number }) => boolean
  wsEmit?: (event: WSEventType, data?: unknown) => void
}

export function ItemDetailModal({
  item,
  isOpen,
  onClose,
  onVote,
  onComment,
  onBattleAction,
  wsEmit,
}: ItemDetailModalProps) {
  const phase = useGameStore((state) => state.phase)
  const votes = useGameStore((state) => state.votes)
  const votingTarget = useGameStore((state) => state.votingTarget)
  const items = useGameStore((state) => state.items)

  const [commentText, setCommentText] = useState('')
  const [authorName, setAuthorName] = useState('')
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // 战斗系统
  const {
    getVoteCount,
    getActionType,
    getActionText,
    executeAction,
    bullet,
  } = useBattleSystem({ emit: wsEmit })

  // 从 store 获取最新的 item（包含评论）
  const currentItem = items.find((i) => i.id === item?.id) || item

  // 滚动到最新评论
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [currentItem?.comments?.length])

  if (!currentItem) return null

  const isVotingPhase = phase === 'voting' || phase === 'viewing' // 支持观看阶段也可以投票
  const isVotingTarget = votingTarget?.id === currentItem.id
  const currentVotes = votes[currentItem.id] || 0
  const comments = currentItem.comments || []

  // 战斗系统：获取票数和操作类型
  const fishVoteCount = getVoteCount(currentItem.id)
  const actionType = getActionType(currentItem.id)
  const actionText = getActionText(currentItem.id)
  const isDisabled = actionType === 'disabled'

  // 按钮样式根据操作类型
  const getButtonStyles = () => {
    switch (actionType) {
      case 'vote':
        return 'bg-gradient-to-r from-red-500 via-orange-500 to-pink-500 border-red-600'
      case 'chase':
        return 'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 border-purple-600'
      case 'switch':
        return 'bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 border-blue-600'
      case 'disabled':
      default:
        return 'bg-gray-400 border-gray-500 cursor-not-allowed'
    }
  }

  // 处理战斗操作
  const handleBattleAction = () => {
    if (isDisabled) return

    // 获取鱼的位置用于漂浮数字
    const position = currentItem.position

    if (onBattleAction) {
      onBattleAction(currentItem.id, position)
    } else {
      executeAction(currentItem.id, position)
    }
  }

  const handleSubmitComment = () => {
    if (!commentText.trim() || !authorName.trim()) return

    onComment?.(currentItem.id, {
      author: authorName.trim(),
      content: commentText.trim(),
    })

    setCommentText('')
  }

  // 防抖处理的回调函数
  const debouncedClose = useDebounceCallback(onClose, 300)
  const debouncedBattleAction = useDebounceCallback(handleBattleAction, 300)
  const debouncedSubmitComment = useDebounceCallback(handleSubmitComment, 300)

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, y: 50, rotate: -10 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.8, y: 50, rotate: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white scribble-card border-pink-400 w-full max-w-sm max-h-[90vh] overflow-hidden relative flex flex-col"
          >
            {/* 装饰星星 */}
            <div className="absolute top-3 left-3 pointer-events-none z-10">
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.3, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-2xl"
              >
                ⭐
              </motion.div>
            </div>

            {/* 关闭按钮 */}
            <motion.button
              onClick={debouncedClose}
              whileHover={{ scale: 1.15, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="absolute top-4 right-4 w-10 h-10 bg-gradient-to-br from-red-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-30 hand-drawn-button border-red-500"
            >
              ✕
            </motion.button>

            {/* 图片展示区 */}
            <div className="relative bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 p-6 overflow-hidden flex-shrink-0">
              {/* 背景装饰 */}
              <div className="absolute inset-0 opacity-10">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{
                      left: `${i * 20 + 10}%`,
                      top: `${(i % 2) * 50}%`,
                    }}
                    animate={{
                      y: [0, -20, 0],
                      rotate: [0, 360],
                    }}
                    transition={{
                      duration: 3 + i,
                      repeat: Infinity,
                      delay: i * 0.5,
                    }}
                  >
                    ✨
                  </motion.div>
                ))}
              </div>

              <motion.div
                animate={{ y: [-4, 4, -4], rotate: [-1, 1, -1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentItem.imageUrl}
                  alt={currentItem.name}
                  className="w-36 h-36 object-contain mx-auto drop-shadow-2xl"
                />
              </motion.div>

              {/* 票数显示徽章 */}
              {fishVoteCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-4 right-14 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg"
                >
                  🗳️ {fishVoteCount}/{ELIMINATION_THRESHOLD}
                </motion.div>
              )}
            </div>

            {/* 信息区 */}
            <div className="p-4 bg-gradient-to-br from-white to-purple-50 flex-shrink-0">
              <motion.h3
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 text-center font-sketch mb-2 transform -rotate-1"
              >
                {currentItem.name}
              </motion.h3>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-yellow-100 border-2 border-yellow-400 rounded-2xl p-3 mb-2 hand-drawn-border transform rotate-1"
              >
                <p className="text-gray-700 text-center font-sketch text-sm">
                  "{currentItem.description}"
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center text-xs text-gray-500 mb-3"
              >
                创作者：<span className="font-bold text-purple-600">{currentItem.author}</span>
              </motion.div>

              {/* 战斗按钮区 */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {/* 票数进度条 */}
                {fishVoteCount > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>票数</span>
                      <span>{fishVoteCount}/{ELIMINATION_THRESHOLD}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(fishVoteCount / ELIMINATION_THRESHOLD) * 100}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* 子弹状态提示 */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <motion.div
                    animate={{
                      backgroundColor: bullet.loaded ? '#ef4444' : '#6b7280',
                      scale: bullet.loaded ? [1, 1.1, 1] : 1,
                    }}
                    transition={{ duration: 0.3 }}
                    className="w-3 h-3 rounded-full"
                  />
                  <span className={`text-xs ${bullet.loaded ? 'text-red-500' : 'text-gray-500'}`}>
                    {bullet.loaded ? '弹药已装填' : '弹药冷却中...'}
                  </span>
                </div>

                {/* 战斗按钮 */}
                <motion.button
                  whileHover={!isDisabled ? { scale: 1.05, rotate: -2 } : {}}
                  whileTap={!isDisabled ? { scale: 0.95, rotate: 2 } : {}}
                  onClick={debouncedBattleAction}
                  disabled={isDisabled}
                  className={`w-full py-4 ${getButtonStyles()} text-white rounded-3xl font-bold text-lg shadow-2xl hand-drawn-button relative overflow-hidden transition-all duration-300`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {actionType === 'vote' && '🎯'}
                    {actionType === 'chase' && '⚡'}
                    {actionType === 'switch' && '🔄'}
                    {actionType === 'disabled' && '⏳'}
                    {actionText}
                  </span>
                  {/* 脉冲效果 */}
                  {!isDisabled && (
                    <motion.div
                      className="absolute inset-0 bg-white"
                      animate={{ opacity: [0, 0.3, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </motion.button>

                {/* 操作提示 */}
                <div className="mt-2 text-center text-xs text-gray-500">
                  {actionType === 'vote' && '投票后进入 7.5 秒冷却'}
                  {actionType === 'chase' && '追击会重置冷却时间'}
                  {actionType === 'switch' && '换目标会自动撤销之前的投票'}
                  {actionType === 'disabled' && '请等待冷却结束'}
                </div>
              </motion.div>
            </div>

            {/* 评论区 */}
            <div className="flex-1 overflow-hidden flex flex-col border-t-2 border-dashed border-purple-200">
              <div className="px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 flex-shrink-0">
                <h4 className="font-sketch text-purple-700 font-bold flex items-center gap-2">
                  💬 评论区
                  <span className="text-sm font-normal text-purple-500">
                    ({comments.length})
                  </span>
                </h4>
              </div>

              {/* 评论列表 */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-[80px] max-h-[120px]">
                {comments.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-4">
                    还没有评论，快来抢沙发吧~ 🛋️
                  </div>
                ) : (
                  comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/80 rounded-xl p-2 border-2 border-blue-200 hand-drawn-border"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🐟</span>
                        <span className="font-bold text-purple-600 text-sm">{comment.author}</span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm pl-7">{comment.content}</p>
                    </motion.div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* 评论输入区 */}
              <div className="p-3 bg-gradient-to-r from-yellow-50 to-pink-50 border-t-2 border-dashed border-yellow-300 flex-shrink-0">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="你的昵称"
                    maxLength={8}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-purple-300 focus:border-purple-500 focus:outline-none text-sm font-sketch bg-white/80"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmitComment()
                      }
                    }}
                    placeholder="说点什么吧..."
                    maxLength={50}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-pink-300 focus:border-pink-500 focus:outline-none text-sm font-sketch bg-white/80"
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={debouncedSubmitComment}
                    disabled={!commentText.trim() || !authorName.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-green-400 to-teal-400 text-white rounded-xl font-bold shadow-md hand-drawn-button border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    发送 ✨
                  </motion.button>
                </div>
              </div>
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

  const isUrgent = timeLeft <= 10

  return (
    <motion.div
      initial={{ y: -50, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -50, opacity: 0, scale: 0.8 }}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-40 px-8 py-4 rounded-full shadow-2xl hand-drawn-button ${
        isUrgent
          ? 'bg-gradient-to-r from-red-600 to-orange-600 border-red-700 animate-danger-pulse'
          : 'bg-gradient-to-r from-red-500 to-pink-500 border-red-600'
      } text-white`}
    >
      <div className="flex items-center gap-4">
        <motion.span
          animate={{
            scale: isUrgent ? [1, 1.3, 1] : 1,
            rotate: isUrgent ? [0, -10, 10, 0] : 0
          }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="text-2xl"
        >
          🔍
        </motion.span>
        <span className="font-bold text-lg">投票中</span>
        <motion.div
          animate={{
            scale: isUrgent ? [1, 1.1, 1] : 1
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className={`px-4 py-2 rounded-full font-mono text-xl font-bold ${
            isUrgent
              ? 'bg-white text-red-600'
              : 'bg-white/20'
          }`}
        >
          {timeLeft}s
        </motion.div>
        {isUrgent && (
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="text-2xl"
          >
            ⚠️
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}

export default ItemDetailModal
