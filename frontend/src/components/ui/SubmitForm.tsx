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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          {/* 预览图 */}
          <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="你的作品"
              className="w-40 h-40 object-contain mx-auto rounded-xl bg-white shadow-lg"
            />
          </div>

          <div className="p-6 space-y-4">
            <h3 className="text-xl font-bold text-center text-gray-800">
              给你的作品起个名字吧！
            </h3>

            {/* 名称输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                名称（8字以内）
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 8))}
                placeholder="例如：小蓝鱼"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-colors font-sketch"
                required
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {name.length}/8
              </div>
            </div>

            {/* 介绍输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                一句话介绍（20字以内）
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 20))}
                placeholder="例如：这就只是一条咸鱼"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-colors font-sketch"
                required
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {description.length}/20
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                返回修改
              </button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!name.trim() || !description.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                放入{theme?.theme_name || '鱼缸'}！🎉
              </motion.button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default SubmitForm
