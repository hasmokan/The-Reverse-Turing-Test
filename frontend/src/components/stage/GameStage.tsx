'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { GameItem } from '@/types'

interface GameStageProps {
  onItemClick?: (item: GameItem) => void
}

// 使用种子生成伪随机数（确保相同索引产生相同结果）
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

function seededRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min)
}

export function GameStage({ onItemClick }: GameStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const items = useGameStore((state) => state.items)
  const turbidity = useGameStore((state) => state.turbidity)
  const phase = useGameStore((state) => state.phase)
  const theme = useGameStore((state) => state.theme)
  const updateItem = useGameStore((state) => state.updateItem)

  // 物理模拟动画 - 左右游动
  const animate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight
    const padding = 60

    items.forEach((item) => {
      const time = Date.now() / 1000
      // 每个物体有独特的相位偏移
      const phaseOffset = parseInt(item.id, 36) % 100

      // 水平移动 (主要方向)
      let newX = item.position.x + item.velocity.vx

      // 垂直方向: 正弦波上下浮动
      const floatAmplitude = 15
      const floatSpeed = 0.5 + (phaseOffset % 10) * 0.05
      const baseY = item.position.y + item.velocity.vy * 0.5
      const floatOffset = Math.sin(time * floatSpeed + phaseOffset) * floatAmplitude
      let newY = baseY + floatOffset * 0.1

      // 边缘检测和翻转
      let newVx = item.velocity.vx
      let newFlipX = item.flipX

      // 碰到左右边缘时翻转
      if (newX <= padding) {
        newX = padding
        newVx = Math.abs(newVx)
        newFlipX = false
      } else if (newX >= width - padding) {
        newX = width - padding
        newVx = -Math.abs(newVx)
        newFlipX = true
      }

      // 上下边缘软限制
      if (newY < padding) {
        newY = padding
        item.velocity.vy = Math.abs(item.velocity.vy) * 0.5
      } else if (newY > height - padding) {
        newY = height - padding
        item.velocity.vy = -Math.abs(item.velocity.vy) * 0.5
      }

      updateItem(item.id, {
        position: { x: newX, y: newY },
        velocity: { vx: newVx, vy: item.velocity.vy },
        flipX: newFlipX,
      })
    })

    animationRef.current = requestAnimationFrame(animate)
  }, [items, updateItem])

  // 启动动画循环
  useEffect(() => {
    if (phase !== 'gameover') {
      animationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate, phase])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-2xl"
      style={{
        backgroundImage: theme?.assets.background_url
          ? `url(${theme.assets.background_url})`
          : 'linear-gradient(180deg, #87CEEB 0%, #5BC0DE 30%, #4AB3D6 60%, #3A9FC5 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* 浑浊度遮罩层 */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          backgroundColor: `rgba(50, 30, 30, ${turbidity * 0.4})`,
          backgroundImage: turbidity > 0.3
            ? `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
            : 'none',
          opacity: turbidity * 0.5,
          mixBlendMode: 'multiply',
        }}
      />

      {/* 气泡粒子效果 */}
      {theme?.assets.particle_effect === 'bubbles' && (
        <Bubbles />
      )}

      {/* 游戏物体 */}
      <AnimatePresence>
        {items.map((item, index) => (
          <FloatingItem
            key={item.id}
            item={item}
            index={index}
            onClick={() => onItemClick?.(item)}
            isGameOver={phase === 'gameover'}
          />
        ))}
      </AnimatePresence>

      {/* Game Over 爆炸效果 */}
      {phase === 'gameover' && (
        <GameOverOverlay />
      )}
    </div>
  )
}

// 漂浮物体组件
function FloatingItem({
  item,
  index,
  onClick,
  isGameOver,
}: {
  item: GameItem
  index: number
  onClick: () => void
  isGameOver: boolean
}) {
  // 使用 index 生成确定性的动画时长
  const animationDuration = useMemo(() => 2 + (index % 10) * 0.1, [index])

  // Game Over 时的离心力飞出效果
  const exitX = (item.position.x - 200) * 5
  const exitY = (item.position.y - 300) * 5
  const exitRotate = seededRange(index + 1000, -180, 180)

  const exitVariants = isGameOver
    ? {
        x: exitX,
        y: exitY,
        rotate: exitRotate,
        opacity: 0,
        scale: 0,
      }
    : { opacity: 0, scale: 0 }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: 1,
        scale: item.scale,
        x: item.position.x,
        y: item.position.y,
        rotate: item.rotation,
        scaleX: item.flipX ? -item.scale : item.scale,
      }}
      exit={exitVariants}
      transition={{
        x: { type: 'tween', duration: 0.05, ease: 'linear' },
        y: { type: 'tween', duration: 0.05, ease: 'linear' },
        scaleX: { type: 'tween', duration: 0.3 },
        default: { type: 'spring', stiffness: 100, damping: 15 },
      }}
      onClick={onClick}
      className="absolute cursor-pointer hover:z-50"
      style={{
        filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.3))',
        transformOrigin: 'center center',
      }}
    >
      {/* 上下浮动效果 */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{
          repeat: Infinity,
          duration: animationDuration,
          ease: 'easeInOut',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          className="w-20 h-20 object-contain pointer-events-none select-none"
          draggable={false}
        />
      </motion.div>
    </motion.div>
  )
}

// 气泡效果 - 客户端渲染
function Bubbles() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 使用确定性的值生成气泡配置
  const bubbles = useMemo(() => {
    return [...Array(15)].map((_, i) => ({
      id: i,
      x: seededRange(i, 0, 400),
      scale: seededRange(i + 100, 0.5, 1.5),
      duration: seededRange(i + 200, 4, 8),
      delay: seededRange(i + 300, 0, 5),
      offsetX: seededRange(i + 400, -30, 30),
    }))
  }, [])

  if (!mounted) {
    return null // 服务端不渲染气泡
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute w-2 h-2 bg-white/20 rounded-full"
          initial={{
            x: bubble.x,
            y: 600,
            scale: bubble.scale,
          }}
          animate={{
            y: -50,
            x: bubble.x + bubble.offsetX,
          }}
          transition={{
            duration: bubble.duration,
            repeat: Infinity,
            delay: bubble.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  )
}

// Game Over 覆盖层
function GameOverOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex items-center justify-center z-50"
    >
      {/* 裂纹效果 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Cpath d='M200 0 L210 150 L300 160 L220 200 L280 350 L200 250 L120 350 L180 200 L100 160 L190 150 Z' fill='none' stroke='%23fff' stroke-width='3' opacity='0.8'/%3E%3C/svg%3E")`,
          backgroundSize: 'cover',
        }}
      />

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.3 }}
        className="bg-red-600/90 text-white px-8 py-4 rounded-2xl shadow-2xl"
      >
        <h2 className="text-3xl font-bold text-center">💥 GAME OVER 💥</h2>
        <p className="text-center mt-2 opacity-80">AI 卧底占领了这里！</p>
      </motion.div>
    </motion.div>
  )
}

export default GameStage
