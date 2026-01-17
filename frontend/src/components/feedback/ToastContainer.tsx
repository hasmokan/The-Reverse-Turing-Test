'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { ToastMessage, ToastType } from '@/types/battle'
import { TOAST_DURATION, BATTLE_COLORS } from '@/lib/battleConstants'

// 根据类型获取样式
function getToastStyles(type: ToastType) {
  switch (type) {
    case 'kill_ai':
      return {
        bg: 'bg-gradient-to-r from-green-500/90 to-emerald-600/90',
        border: 'border-green-400',
        icon: '🎯',
      }
    case 'kill_human':
      return {
        bg: 'bg-gradient-to-r from-red-500/90 to-rose-600/90',
        border: 'border-red-400',
        icon: '💀',
      }
    case 'self_caught':
      return {
        bg: 'bg-gradient-to-r from-gray-600/90 to-gray-700/90',
        border: 'border-gray-400',
        icon: '😵',
      }
    case 'being_attacked':
      return {
        bg: 'bg-gradient-to-r from-orange-500/90 to-amber-600/90',
        border: 'border-orange-400',
        icon: '⚠️',
      }
    case 'info':
    default:
      return {
        bg: 'bg-gradient-to-r from-blue-500/90 to-indigo-600/90',
        border: 'border-blue-400',
        icon: 'ℹ️',
      }
  }
}

interface ToastItemProps {
  toast: ToastMessage
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const styles = getToastStyles(toast.type)

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id)
    }, TOAST_DURATION)

    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 25,
        duration: 0.2,
      }}
      className={`
        ${styles.bg} ${styles.border}
        border-2 rounded-xl px-4 py-3
        shadow-lg shadow-black/20
        backdrop-blur-sm
        max-w-sm
        pointer-events-auto
        cursor-pointer
      `}
      onClick={() => onRemove(toast.id)}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{styles.icon}</span>
        <p className="text-white text-sm font-medium whitespace-pre-line leading-relaxed">
          {toast.content}
        </p>
      </div>
    </motion.div>
  )
}

export function ToastContainer() {
  const toasts = useGameStore((state) => state.toasts)
  const removeToast = useGameStore((state) => state.removeToast)

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastContainer
