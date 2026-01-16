'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { useImageReview } from '@/hooks/useImageReview'
import { hasMinimaxApiKey } from '@/lib/minimax'

interface SubmitFormProps {
  imageUrl: string
  onSubmit: (name: string, description: string) => void
  onCancel: () => void
}

export function SubmitForm({ imageUrl, onSubmit, onCancel }: SubmitFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const theme = useGameStore((state) => state.theme)
  const { status, result, reviewImage, reset } = useImageReview()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !description.trim()) return

    // 进行 AI 审核
    const reviewResult = await reviewImage(imageUrl)

    // 审核通过，延迟后提交
    if (reviewResult.isValid) {
      setTimeout(() => {
        onSubmit(name.trim(), description.trim())
      }, 1500)
    }
  }

  const handleForceSubmit = () => {
    onSubmit(name.trim(), description.trim())
  }

  const handleRetry = () => {
    reset()
  }

  // 渲染审核状态覆盖层
  const renderOverlay = () => {
    if (status === 'reviewing') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="text-6xl mb-4"
          >
            🔍
          </motion.div>
          <motion.h3
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-xl font-bold text-purple-600 font-sketch"
          >
            AI正在审核你的画作...
          </motion.h3>
          <p className="text-gray-500 text-sm mt-2">判断是否符合主题</p>
        </motion.div>
      )
    }

    if (status === 'approved') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 bg-green-50/95 backdrop-blur-sm flex flex-col items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5 }}
            className="text-7xl mb-4"
          >
            ✅
          </motion.div>
          <motion.h3
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-green-600 font-sketch"
          >
            审核通过！
          </motion.h3>
          {result && (
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-green-700 text-sm mt-2 text-center px-4"
            >
              {result.detectedContent}
              <br />
              <span className="text-xs text-green-500">置信度: {result.confidence}%</span>
            </motion.p>
          )}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-sm text-green-600 mt-4"
          >
            正在放入鱼缸...
          </motion.div>
        </motion.div>
      )
    }

    if (status === 'rejected') {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 bg-orange-50/95 backdrop-blur-sm flex flex-col items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1], rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
            className="text-6xl mb-4"
          >
            🤔
          </motion.div>
          <motion.h3
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xl font-bold text-orange-600 font-sketch text-center"
          >
            嗯...这好像不太符合主题
          </motion.h3>
          {result && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-3 p-3 bg-orange-100 rounded-xl text-center"
            >
              <p className="text-orange-700 text-sm">{result.detectedContent}</p>
              {result.suggestion && (
                <p className="text-orange-600 text-xs mt-1">💡 {result.suggestion}</p>
              )}
            </motion.div>
          )}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex gap-3 mt-6 w-full"
          >
            <motion.button
              onClick={handleRetry}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 py-3 bg-gradient-to-r from-blue-400 to-purple-400 text-white rounded-xl font-bold hand-drawn-button border-purple-500"
            >
              🎨 重新画
            </motion.button>
            <motion.button
              onClick={handleForceSubmit}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 py-3 bg-gradient-to-r from-gray-300 to-gray-400 text-gray-700 rounded-xl font-bold hand-drawn-button border-gray-500"
            >
              😈 我就要！
            </motion.button>
          </motion.div>
        </motion.div>
      )
    }

    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, y: 50, rotate: -5 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        exit={{ scale: 0.8, y: 50, rotate: 5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-white scribble-card border-pink-400 w-full max-w-sm overflow-hidden relative"
      >
        {/* 审核状态覆盖层 */}
        <AnimatePresence>{renderOverlay()}</AnimatePresence>

        {/* 星星装饰 */}
        <div className="absolute top-4 right-4 pointer-events-none">
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-3xl"
          >
            ✨
          </motion.div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 预览图 */}
          <div className="bg-gradient-to-br from-yellow-100 via-pink-100 to-blue-100 p-8 relative overflow-hidden">
            {/* 背景装饰 */}
            <div className="absolute inset-0 opacity-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute top-0 left-0 w-20 h-20 border-4 border-dashed border-pink-400 rounded-full"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute bottom-0 right-0 w-16 h-16 border-4 border-dashed border-blue-400 rounded-full"
              />
            </div>

            <motion.div
              animate={{ y: [-5, 5, -5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="你的作品"
                className="w-44 h-44 object-contain mx-auto rounded-2xl bg-white shadow-2xl p-4 hand-drawn-border border-purple-400"
              />
            </motion.div>

            {/* AI 审核状态指示 */}
            <div
              className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold ${
                hasMinimaxApiKey()
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
              }`}
            >
              {hasMinimaxApiKey() ? '🤖 AI审核' : '⚠️ 未配置'}
            </div>
          </div>

          <div className="p-6 space-y-5">
            <motion.h3
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 font-sketch transform -rotate-1"
            >
              给你的作品起个名字吧！
            </motion.h3>

            {/* 名称输入 */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <label className="block text-sm font-bold text-purple-700 mb-2 font-sketch">
                🎨 名称（8字以内）
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 8))}
                placeholder="例如：小蓝鱼"
                className="w-full px-5 py-4 border-3 border-purple-300 rounded-2xl focus:border-purple-500 focus:outline-none transition-all font-sketch text-lg hand-drawn-border bg-purple-50/50"
                required
                disabled={status === 'reviewing'}
              />
              <div className="text-right text-xs text-gray-500 mt-1 font-mono">
                {name.length}/8
              </div>
            </motion.div>

            {/* 介绍输入 */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <label className="block text-sm font-bold text-purple-700 mb-2 font-sketch">
                💬 一句话介绍（20字以内）
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 20))}
                placeholder="例如：这就只是一条咸鱼"
                className="w-full px-5 py-4 border-3 border-purple-300 rounded-2xl focus:border-purple-500 focus:outline-none transition-all font-sketch text-lg hand-drawn-border bg-purple-50/50"
                required
                disabled={status === 'reviewing'}
              />
              <div className="text-right text-xs text-gray-500 mt-1 font-mono">
                {description.length}/20
              </div>
            </motion.div>

            {/* 按钮 */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex gap-3 pt-3"
            >
              <motion.button
                type="button"
                onClick={onCancel}
                whileHover={{ scale: 1.05, rotate: -2 }}
                whileTap={{ scale: 0.95 }}
                disabled={status === 'reviewing'}
                className="flex-1 py-4 bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 rounded-2xl font-bold hover:from-gray-300 hover:to-gray-400 transition-all hand-drawn-button border-gray-400 shadow-lg disabled:opacity-50"
              >
                返回修改
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                disabled={!name.trim() || !description.trim() || status === 'reviewing'}
                className="flex-1 py-4 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hand-drawn-button border-purple-600 shadow-xl relative overflow-hidden"
              >
                <span className="relative z-10">
                  放入{theme?.theme_name || '鱼缸'}！🎉
                </span>
                {/* 闪光效果 */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                />
              </motion.button>
            </motion.div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default SubmitForm
