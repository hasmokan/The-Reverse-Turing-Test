'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ANIMATION_CONFIG } from '@/lib/battleConstants'

interface CrackEffectProps {
  active: boolean
}

// 裂纹 SVG 路径
const CrackPaths = [
  'M200,0 L220,100 L180,200 L240,350 L160,500',
  'M200,0 L170,80 L230,180 L150,280 L260,400 L180,500',
  'M200,0 L250,120 L140,220 L270,340 L130,500',
]

export function CrackEffect({ active }: CrackEffectProps) {
  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-[95]">
          {/* 灰色叠加层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-gray-900"
          />

          {/* 裂纹效果 */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 400 500"
            preserveAspectRatio="xMidYMid slice"
          >
            {CrackPaths.map((path, index) => (
              <motion.path
                key={index}
                d={path}
                stroke="white"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.8 }}
                transition={{
                  duration: ANIMATION_CONFIG.crack.duration,
                  delay: index * 0.1,
                  ease: 'easeOut',
                }}
              />
            ))}
          </svg>

          {/* 碎片效果 */}
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-4 h-4 bg-white/30"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: '40%',
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              }}
              initial={{ y: 0, opacity: 1, rotate: 0 }}
              animate={{
                y: 300 + Math.random() * 200,
                opacity: 0,
                rotate: Math.random() * 360,
              }}
              transition={{
                duration: 1.5,
                delay: 0.3 + i * 0.05,
                ease: 'easeIn',
              }}
            />
          ))}

          {/* 震动效果通过 CSS 实现 */}
          <style jsx>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
              20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  )
}

export default CrackEffect
