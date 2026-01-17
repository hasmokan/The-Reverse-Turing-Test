'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { FloatingDamage as FloatingDamageType } from '@/types/battle'
import { FLOATING_DAMAGE_DURATION, ANIMATION_CONFIG } from '@/lib/battleConstants'

interface FloatingDamageItemProps {
  damage: FloatingDamageType
  onComplete: (id: string) => void
}

function FloatingDamageItem({ damage, onComplete }: FloatingDamageItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete(damage.id)
    }, FLOATING_DAMAGE_DURATION)

    return () => clearTimeout(timer)
  }, [damage.id, onComplete])

  return (
    <motion.div
      initial={{
        opacity: 1,
        y: 0,
        scale: 0.5,
      }}
      animate={{
        opacity: 0,
        y: -ANIMATION_CONFIG.floatingDamage.riseDistance,
        scale: 1,
      }}
      transition={{
        duration: ANIMATION_CONFIG.floatingDamage.duration,
        ease: 'easeOut',
      }}
      className="absolute pointer-events-none z-50"
      style={{
        left: damage.x,
        top: damage.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <span className="text-2xl font-bold text-red-500 drop-shadow-lg">
        +{damage.value}
      </span>
    </motion.div>
  )
}

export function FloatingDamageLayer() {
  const floatingDamages = useGameStore((state) => state.floatingDamages)
  const removeFloatingDamage = useGameStore((state) => state.removeFloatingDamage)

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {floatingDamages.map((damage) => (
          <FloatingDamageItem
            key={damage.id}
            damage={damage}
            onComplete={removeFloatingDamage}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default FloatingDamageLayer
