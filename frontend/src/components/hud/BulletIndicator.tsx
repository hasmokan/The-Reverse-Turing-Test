'use client'

import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/store'

interface BulletIndicatorProps {
  compact?: boolean
}

export function BulletIndicator({ compact = false }: BulletIndicatorProps) {
  const bullet = useGameStore((state) => state.bullet)

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <motion.div
          animate={{
            backgroundColor: bullet.loaded ? '#ef4444' : '#6b7280',
            scale: bullet.loaded ? [1, 1.1, 1] : 1,
          }}
          transition={{ duration: 0.3 }}
          className="w-3 h-3 rounded-full"
        />
        <span className={`text-xs ${bullet.loaded ? 'text-red-400' : 'text-gray-400'}`}>
          {bullet.loaded ? '1' : '0'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-full">
      <span className="text-white/60 text-xs">弹药</span>
      <div className="flex gap-1">
        <motion.div
          animate={{
            backgroundColor: bullet.loaded ? '#ef4444' : '#374151',
            boxShadow: bullet.loaded ? '0 0 8px rgba(239, 68, 68, 0.5)' : 'none',
          }}
          className="w-4 h-4 rounded-full border-2 border-white/20"
        />
      </div>
      <span className={`text-xs font-bold ${bullet.loaded ? 'text-red-400' : 'text-gray-500'}`}>
        {bullet.loaded ? '1/1' : '0/1'}
      </span>
    </div>
  )
}

export default BulletIndicator
