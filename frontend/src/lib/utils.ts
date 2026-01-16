import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 生成唯一 ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 随机范围数
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

// 限制数值范围
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// 计算浑浊度 (0-1)
export function calculateTurbidity(aiCount: number, maxAI: number): number {
  return clamp(aiCount / maxAI, 0, 1)
}

// 平滑点位 (用于绘画)
export function smoothPoints(
  points: { x: number; y: number }[],
  tension: number = 0.3
): { x: number; y: number }[] {
  if (points.length < 2) return points

  const smoothed: { x: number; y: number }[] = [points[0]]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    smoothed.push({
      x: curr.x + (next.x - prev.x) * tension * 0.1,
      y: curr.y + (next.y - prev.y) * tension * 0.1,
    })
  }

  smoothed.push(points[points.length - 1])
  return smoothed
}

// 添加手绘抖动效果
export function addWobble(
  x: number,
  y: number,
  intensity: number = 1
): { x: number; y: number } {
  return {
    x: x + (Math.random() - 0.5) * intensity,
    y: y + (Math.random() - 0.5) * intensity,
  }
}
