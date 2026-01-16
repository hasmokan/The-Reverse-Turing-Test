'use client'

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useGameStore } from '@/lib/store'
import { addWobble } from '@/lib/utils'

interface Point {
  x: number
  y: number
}

export interface DrawingCanvasRef {
  exportImage: () => string | null
  clearCanvas: () => void
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef>(function DrawingCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState<1 | 2 | 3>(2)
  const [currentColor, setCurrentColor] = useState<string>('#FF6B6B')
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const lastPointRef = useRef<Point | null>(null)

  const theme = useGameStore((state) => state.theme)
  const palette = theme?.palette || ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']

  const brushSizes = {
    1: 4,
    2: 8,
    3: 14,
  }

  // 初始化画布
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 高清屏适配
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    contextRef.current = ctx

    // 保存初始状态
    saveToHistory()
  }, [])

  // 保存历史记录
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = contextRef.current
    if (!canvas || !ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(imageData)
      // 最多保存5步
      if (newHistory.length > 5) {
        newHistory.shift()
        return newHistory
      }
      return newHistory
    })
    setHistoryIndex((prev) => Math.min(prev + 1, 4))
  }, [historyIndex])

  // 撤销
  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const ctx = contextRef.current
    if (!ctx) return

    const newIndex = historyIndex - 1
    ctx.putImageData(history[newIndex], 0, 0)
    setHistoryIndex(newIndex)
  }, [history, historyIndex])

  // 重做
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const ctx = contextRef.current
    if (!ctx) return

    const newIndex = historyIndex + 1
    ctx.putImageData(history[newIndex], 0, 0)
    setHistoryIndex(newIndex)
  }, [history, historyIndex])

  // 获取触摸/鼠标位置
  const getPosition = (e: React.TouchEvent | React.MouseEvent): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  // 绘制带抖动效果的线条
  const drawLine = (from: Point, to: Point) => {
    const ctx = contextRef.current
    if (!ctx) return

    ctx.strokeStyle = currentColor
    ctx.lineWidth = brushSizes[brushSize]

    ctx.beginPath()

    // 添加轻微抖动，模拟手绘效果
    const wobbleIntensity = brushSize * 0.5
    const fromWobble = addWobble(from.x, from.y, wobbleIntensity)
    const toWobble = addWobble(to.x, to.y, wobbleIntensity)

    ctx.moveTo(fromWobble.x, fromWobble.y)

    // 使用二次贝塞尔曲线让线条更自然
    const midX = (fromWobble.x + toWobble.x) / 2
    const midY = (fromWobble.y + toWobble.y) / 2
    ctx.quadraticCurveTo(fromWobble.x, fromWobble.y, midX, midY)
    ctx.quadraticCurveTo(midX, midY, toWobble.x, toWobble.y)

    ctx.stroke()
  }

  // 开始绘制
  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const point = getPosition(e)
    lastPointRef.current = point
    setIsDrawing(true)

    // 画一个点
    const ctx = contextRef.current
    if (ctx) {
      ctx.fillStyle = currentColor
      ctx.beginPath()
      ctx.arc(point.x, point.y, brushSizes[brushSize] / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 绘制中
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return
    e.preventDefault()

    const point = getPosition(e)
    if (lastPointRef.current) {
      drawLine(lastPointRef.current, point)
    }
    lastPointRef.current = point
  }

  // 结束绘制
  const endDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      lastPointRef.current = null
      saveToHistory()
    }
  }

  // 清空画布
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = contextRef.current
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    saveToHistory()
  }, [saveToHistory])

  // 导出为PNG (带透明背景)
  const exportImage = useCallback((): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    return canvas.toDataURL('image/png')
  }, [])

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    exportImage,
    clearCanvas,
  }), [exportImage, clearCanvas])

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
        {/* 笔刷大小 */}
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                brushSize === size
                  ? 'bg-gray-800 text-white scale-110'
                  : 'bg-white border-2 border-gray-300 hover:border-gray-400'
              }`}
            >
              <span
                className="rounded-full bg-current"
                style={{
                  width: brushSizes[size],
                  height: brushSizes[size],
                }}
              />
            </button>
          ))}
        </div>

        {/* 撤销/重做 */}
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center disabled:opacity-40 hover:border-gray-400 transition-all"
          >
            ↩️
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center disabled:opacity-40 hover:border-gray-400 transition-all"
          >
            ↪️
          </button>
          <button
            onClick={clearCanvas}
            className="w-10 h-10 rounded-full bg-white border-2 border-red-300 flex items-center justify-center hover:bg-red-50 transition-all"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 画布区域 */}
      <div className="flex-1 relative bg-white" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
        />

        {/* 网格背景 (视觉参考) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(to right, #ccc 1px, transparent 1px),
              linear-gradient(to bottom, #ccc 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      {/* 色板 */}
      <div className="flex items-center justify-center gap-3 p-4 bg-gray-50 border-t">
        {palette.map((color) => (
          <button
            key={color}
            onClick={() => setCurrentColor(color)}
            className={`w-12 h-12 rounded-full border-4 transition-all ${
              currentColor === color
                ? 'border-gray-800 scale-110 shadow-lg'
                : 'border-white shadow-md hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
})

export default DrawingCanvas
