'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { FloatingDamage as FloatingDamageType } from '@/types/battle'
import { FLOATING_DAMAGE_DURATION } from '@/lib/battleConstants'

interface FloatingDamageItemProps {
  damage: FloatingDamageType
  onComplete: (id: string) => void
}

// 枪口火焰效果
function MuzzleFlash({ x, y }: { x: number; y: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ opacity: 1, scale: 0 }}
      animate={{ opacity: 0, scale: 2.5 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {/* 主火焰 */}
      <div className="relative">
        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-yellow-400 rounded-full blur-md" />
        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-orange-500 rounded-full blur-sm" />
        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full" />
      </div>
    </motion.div>
  )
}

// 子弹冲击波
function ImpactWave({ x, y }: { x: number; y: number }) {
  return (
    <>
      {/* 外圈冲击波 */}
      <motion.div
        className="absolute pointer-events-none rounded-full border-4 border-yellow-400"
        style={{
          left: x,
          top: y,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ width: 0, height: 0, opacity: 1 }}
        animate={{ width: 120, height: 120, opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      {/* 内圈冲击波 */}
      <motion.div
        className="absolute pointer-events-none rounded-full border-2 border-orange-500"
        style={{
          left: x,
          top: y,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ width: 0, height: 0, opacity: 1 }}
        animate={{ width: 80, height: 80, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
      />
    </>
  )
}

// 弹壳粒子
function BulletParticles({ x, y }: { x: number; y: number }) {
  // 预计算粒子数据，避免渲染时重复计算随机值
  const particles = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2
    const distance = 60 + Math.random() * 40
    const targetX = Math.cos(angle) * distance
    const targetY = Math.sin(angle) * distance
    const rotation = Math.random() * 720 - 360

    return { id: i, targetX, targetY, rotation, delay: Math.random() * 0.1 }
  }), [])

  return (
    <>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full pointer-events-none"
          style={{
            left: x,
            top: y,
            boxShadow: '0 0 6px 2px rgba(251, 191, 36, 0.6)',
          }}
          initial={{
            x: 0,
            y: 0,
            opacity: 1,
            scale: 1,
            rotate: 0
          }}
          animate={{
            x: particle.targetX,
            y: particle.targetY,
            opacity: 0,
            scale: 0,
            rotate: particle.rotation
          }}
          transition={{
            duration: 0.5,
            ease: 'easeOut',
            delay: particle.delay
          }}
        />
      ))}
    </>
  )
}

// 火花效果
function Sparks({ x, y }: { x: number; y: number }) {
  // 预计算火花数据，避免渲染时重复计算随机值
  const sparks = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5
    const length = 30 + Math.random() * 20

    return { id: i, angle, length }
  }), [])

  return (
    <>
      {sparks.map((spark) => (
        <motion.div
          key={spark.id}
          className="absolute pointer-events-none origin-center"
          style={{
            left: x,
            top: y,
            width: 3,
            height: spark.length,
            background: 'linear-gradient(to bottom, #fbbf24, #f97316, transparent)',
            transform: `rotate(${spark.angle}rad)`,
            transformOrigin: 'top center',
          }}
          initial={{ opacity: 1, scaleY: 0 }}
          animate={{ opacity: 0, scaleY: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

function FloatingDamageItem({ damage, onComplete }: FloatingDamageItemProps) {
  const [showEffects, setShowEffects] = useState(true)

  useEffect(() => {
    // 效果很快消失
    const effectTimer = setTimeout(() => {
      setShowEffects(false)
    }, 300)

    const timer = setTimeout(() => {
      onComplete(damage.id)
    }, FLOATING_DAMAGE_DURATION + 200)

    return () => {
      clearTimeout(timer)
      clearTimeout(effectTimer)
    }
  }, [damage.id, onComplete])

  return (
    <>
      {/* 枪击特效 */}
      {showEffects && (
        <>
          <MuzzleFlash x={damage.x} y={damage.y} />
          <ImpactWave x={damage.x} y={damage.y} />
          <BulletParticles x={damage.x} y={damage.y} />
          <Sparks x={damage.x} y={damage.y} />
        </>
      )}

      {/* +1 数字 - 更大更醒目 */}
      <motion.div
        initial={{
          opacity: 0,
          y: 20,
          scale: 0.3,
          rotate: -15,
        }}
        animate={{
          opacity: [0, 1, 1, 0],
          y: [20, 0, -30, -80],
          scale: [0.3, 1.5, 1.2, 0.8],
          rotate: [-15, 5, 0, 0],
        }}
        transition={{
          duration: 1,
          times: [0, 0.15, 0.5, 1],
          ease: 'easeOut',
        }}
        className="absolute pointer-events-none z-50"
        style={{
          left: damage.x,
          top: damage.y,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* 外发光 */}
        <div className="relative">
          <span
            className="absolute text-6xl font-black text-red-500 blur-sm"
            style={{
              WebkitTextStroke: '2px rgba(239, 68, 68, 0.5)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            +{damage.value}
          </span>
          {/* 主文字 */}
          <span
            className="relative text-6xl font-black"
            style={{
              color: '#fff',
              WebkitTextStroke: '3px #dc2626',
              textShadow: `
                0 0 10px rgba(239, 68, 68, 0.8),
                0 0 20px rgba(239, 68, 68, 0.6),
                0 0 30px rgba(239, 68, 68, 0.4),
                0 2px 4px rgba(0, 0, 0, 0.5)
              `,
            }}
          >
            +{damage.value}
          </span>
        </div>
      </motion.div>

      {/* 命中标记 */}
      <motion.div
        initial={{ opacity: 1, scale: 0 }}
        animate={{ opacity: 0, scale: 1.5 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute pointer-events-none"
        style={{
          left: damage.x,
          top: damage.y,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg width="60" height="60" viewBox="0 0 60 60">
          {/* 十字准星 */}
          <motion.g
            initial={{ rotate: 0, opacity: 0.8 }}
            animate={{ rotate: 45, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ transformOrigin: '30px 30px' }}
          >
            <line x1="30" y1="5" x2="30" y2="20" stroke="#ef4444" strokeWidth="3" />
            <line x1="30" y1="40" x2="30" y2="55" stroke="#ef4444" strokeWidth="3" />
            <line x1="5" y1="30" x2="20" y2="30" stroke="#ef4444" strokeWidth="3" />
            <line x1="40" y1="30" x2="55" y2="30" stroke="#ef4444" strokeWidth="3" />
          </motion.g>
        </svg>
      </motion.div>
    </>
  )
}

export function FloatingDamageLayer() {
  const floatingDamages = useGameStore((state) => state.floatingDamages)
  const removeFloatingDamage = useGameStore((state) => state.removeFloatingDamage)

  // 屏幕震动效果
  const [shake, setShake] = useState(false)

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 150)
  }, [])

  // 当有新伤害时触发震动
  useEffect(() => {
    if (floatingDamages.length > 0) {
      triggerShake()
    }
  }, [floatingDamages.length, triggerShake])

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-50"
      animate={shake ? {
        x: [0, -3, 3, -3, 3, 0],
        y: [0, 2, -2, 2, -2, 0],
      } : {}}
      transition={{ duration: 0.15 }}
    >
      <AnimatePresence>
        {floatingDamages.map((damage) => (
          <FloatingDamageItem
            key={damage.id}
            damage={damage}
            onComplete={removeFloatingDamage}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

export default FloatingDamageLayer
