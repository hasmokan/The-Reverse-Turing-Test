'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ANIMATION_CONFIG } from '@/lib/battleConstants'

interface Particle {
  id: number
  x: number
  y: number
  rotation: number
  scale: number
  color: string
  delay: number
}

interface ConfettiEffectProps {
  active: boolean
  onComplete?: () => void
}

const COLORS = [
  '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3',
  '#f38181', '#aa96da', '#fcbad3', '#a8d8ea',
]

export function ConfettiEffect({ active, onComplete }: ConfettiEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([])

  const generateParticles = useMemo(() => {
    if (!active) return []

    return Array.from({ length: ANIMATION_CONFIG.confetti.particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // 百分比
      y: -10,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.5,
    }))
  }, [active])

  useEffect(() => {
    if (active) {
      setParticles(generateParticles)

      const timer = setTimeout(() => {
        onComplete?.()
      }, ANIMATION_CONFIG.confetti.duration)

      return () => clearTimeout(timer)
    }
  }, [active, generateParticles, onComplete])

  if (!active || particles.length === 0) {
    return null
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[95] overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-3 h-3"
          style={{
            left: `${particle.x}%`,
            backgroundColor: particle.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
          initial={{
            y: -20,
            rotate: 0,
            scale: particle.scale,
          }}
          animate={{
            y: '120vh',
            rotate: particle.rotation + 720,
            x: [0, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            delay: particle.delay,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  )
}

export default ConfettiEffect
