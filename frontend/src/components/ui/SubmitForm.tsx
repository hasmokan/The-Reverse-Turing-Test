'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/store'

interface SubmitFormProps {
  imageUrl: string
  onSubmit: (name: string, description: string) => void
  onCancel: () => void
}

export function SubmitForm({ imageUrl, onSubmit, onCancel }: SubmitFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const theme = useGameStore((state) => state.theme)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() && description.trim()) {
      onSubmit(name.trim(), description.trim())
    }
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
                className="flex-1 py-4 bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 rounded-2xl font-bold hover:from-gray-300 hover:to-gray-400 transition-all hand-drawn-button border-gray-400 shadow-lg"
              >
                返回修改
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                disabled={!name.trim() || !description.trim()}
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
