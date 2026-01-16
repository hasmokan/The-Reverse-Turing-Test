'use client'

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { motion } from 'framer-motion'
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

  // 获取绘制内容的边界框
  const getContentBounds = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = contextRef.current
    if (!canvas || !ctx) return null

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const { data, width, height } = imageData

    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let hasContent = false

    // 扫描所有像素找到有内容的边界
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3]
        if (alpha > 0) {
          hasContent = true
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }

    if (!hasContent) return null

    // 添加一点边距
    const padding = 10
    minX = Math.max(0, minX - padding)
    minY = Math.max(0, minY - padding)
    maxX = Math.min(width - 1, maxX + padding)
    maxY = Math.min(height - 1, maxY + padding)

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    }
  }, [])

  // 导出为PNG (带透明背景，自动裁剪并放大小图)
  const exportImage = useCallback((): string | null => {
    const canvas = canvasRef.current
    const ctx = contextRef.current
    if (!canvas || !ctx) return null

    const bounds = getContentBounds()
    if (!bounds) return null // 没有绘制内容

    const MIN_SIZE = 80 // 最小尺寸要求
    const TARGET_SIZE = 120 // 目标尺寸

    // 创建临时画布裁剪内容
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return null

    // 计算缩放比例
    const contentWidth = bounds.width
    const contentHeight = bounds.height
    const maxDimension = Math.max(contentWidth, contentHeight)

    let scale = 1
    if (maxDimension < MIN_SIZE) {
      // 如果内容太小，放大到目标尺寸
      scale = TARGET_SIZE / maxDimension
    }

    const outputWidth = Math.round(contentWidth * scale)
    const outputHeight = Math.round(contentHeight * scale)

    tempCanvas.width = outputWidth
    tempCanvas.height = outputHeight

    // 启用图像平滑（放大时更好看）
    tempCtx.imageSmoothingEnabled = true
    tempCtx.imageSmoothingQuality = 'high'

    // 绘制裁剪并缩放后的内容
    tempCtx.drawImage(
      canvas,
      bounds.x, bounds.y, bounds.width, bounds.height, // 源区域
      0, 0, outputWidth, outputHeight // 目标区域
    )

    return tempCanvas.toDataURL('image/png')
  }, [getContentBounds])

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    exportImage,
    clearCanvas,
  }), [exportImage, clearCanvas])

  return (
    <div className="flex flex-col h-full bg-white scribble-card border-purple-400 overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 via-pink-50 to-blue-50 border-b-4 border-dashed border-purple-300">
        {/* 笔刷大小 */}
        <div className="flex gap-3">
          {([1, 2, 3] as const).map((size) => (
            <motion.button
              key={size}
              onClick={() => setBrushSize(size)}
              whileHover={{ scale: 1.15, rotate: size * 5 }}
              whileTap={{ scale: 0.9 }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hand-drawn-button ${
                brushSize === size
                  ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white border-purple-700 shadow-lg scale-110'
                  : 'bg-white border-2 border-gray-300 text-gray-600 hover:border-purple-400'
              }`}
            >
              <span
                className="rounded-full bg-current"
                style={{
                  width: brushSizes[size] + 2,
                  height: brushSizes[size] + 2,
                }}
              />
            </motion.button>
          ))}
        </div>

        {/* 撤销/重做/清除 */}
        <div className="flex gap-3">
          <motion.button
            onClick={undo}
            disabled={historyIndex <= 0}
            whileHover={{ scale: 1.1, rotate: -10 }}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-full bg-white border-2 border-blue-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 transition-all hand-drawn-button text-xl shadow-md"
          >
            ↩️
          </motion.button>
          <motion.button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-full bg-white border-2 border-blue-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 transition-all hand-drawn-button text-xl shadow-md"
          >
            ↪️
          </motion.button>
          <motion.button
            onClick={clearCanvas}
            whileHover={{ scale: 1.15, rotate: -5 }}
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 rounded-full bg-white border-2 border-red-400 flex items-center justify-center hover:bg-red-50 transition-all hand-drawn-button text-xl shadow-md"
          >
            🗑️
          </motion.button>
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

        {/* 网格背景 (视觉参考) - 儿童画风格点状 */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle, #999 1px, transparent 1px)`,
            backgroundSize: '25px 25px',
          }}
        />

        {/* 画布装饰边框 */}
        <div className="absolute inset-2 pointer-events-none border-2 border-dashed border-purple-200 rounded-lg opacity-30" />
      </div>

      {/* 色板 - 儿童画风格 */}
      <div className="flex items-center justify-center gap-3 p-5 bg-gradient-to-r from-pink-50 via-yellow-50 to-blue-50 border-t-4 border-dashed border-purple-300">
        {palette.map((color, index) => (
          <motion.button
            key={color}
            onClick={() => setCurrentColor(color)}
            whileHover={{ scale: 1.3, rotate: 360, y: -8 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`w-14 h-14 rounded-full border-4 transition-all relative hand-drawn-button ${
              currentColor === color
                ? 'border-gray-800 scale-125 z-10'
                : 'border-white hover:border-gray-300'
            }`}
            style={{
              backgroundColor: color,
              boxShadow: currentColor === color
                ? `0 4px 15px ${color}80, 0 0 0 3px ${color}40`
                : `0 2px 8px ${color}60`
            }}
          >
            {/* 选中标记 */}
            {currentColor === color && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                className="absolute inset-0 flex items-center justify-center text-white text-2xl font-bold"
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
              >
                ✓
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  )
})

export default DrawingCanvas
