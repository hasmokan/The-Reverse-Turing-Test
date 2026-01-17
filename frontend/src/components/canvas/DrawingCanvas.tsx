'use client'

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/lib/store'
import { addWobble } from '@/lib/utils'

interface Point {
  x: number
  y: number
}

// 笔触类型：勾边笔触在顶层，普通笔触在底层
type BrushMode = 'outline' | 'fill'

export interface DrawingCanvasRef {
  exportImage: () => string | null
  clearCanvas: () => void
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef>(function DrawingCanvas(_, ref) {
  // 双层 Canvas：底层为填充层，顶层为勾边层
  const fillCanvasRef = useRef<HTMLCanvasElement>(null)
  const outlineCanvasRef = useRef<HTMLCanvasElement>(null)
  const fillCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const outlineCtxRef = useRef<CanvasRenderingContext2D | null>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const outlineBrushSize = 10 // 勾边模式固定 10px
  const fillBrushSize = 10 // 填色模式固定 10px
  const [brushMode, setBrushMode] = useState<BrushMode>('outline') // 默认勾边模式
  const [currentColor, setCurrentColor] = useState<string>('#333333') // 勾边默认黑色
  const [history, setHistory] = useState<{ fill: ImageData; outline: ImageData }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [hasOutlineDrawn, setHasOutlineDrawn] = useState(false) // 是否已经画过勾边
  const lastPointRef = useRef<Point | null>(null)

  const theme = useGameStore((state) => state.theme)

  // 填色调色板：至少8种鲜艳颜色
  const fillPalette = [
    '#FF6B6B', // 珊瑚红
    '#FF8C42', // 橙色
    '#FFEAA7', // 柠檬黄
    '#96CEB4', // 薄荷绿
    '#4ECDC4', // 青色
    '#45B7D1', // 天蓝
    '#A29BFE', // 薰衣草紫
    '#FF85A2', // 粉红
  ]

  // 勾边专用颜色（深色系）
  const outlineColors = ['#333333', '#1a1a2e', '#4a4e69', '#22223b', '#3d405b']

  // 初始化双层画布
  useEffect(() => {
    const fillCanvas = fillCanvasRef.current
    const outlineCanvas = outlineCanvasRef.current
    if (!fillCanvas || !outlineCanvas) return

    // 高清屏适配
    const dpr = window.devicePixelRatio || 1
    const rect = fillCanvas.getBoundingClientRect()

    // 设置两个画布尺寸
    fillCanvas.width = rect.width * dpr
    fillCanvas.height = rect.height * dpr
    outlineCanvas.width = rect.width * dpr
    outlineCanvas.height = rect.height * dpr

    const fillCtx = fillCanvas.getContext('2d')
    const outlineCtx = outlineCanvas.getContext('2d')
    if (!fillCtx || !outlineCtx) return

    // 配置填充层
    fillCtx.scale(dpr, dpr)
    fillCtx.lineCap = 'round'
    fillCtx.lineJoin = 'round'
    fillCtxRef.current = fillCtx

    // 配置勾边层
    outlineCtx.scale(dpr, dpr)
    outlineCtx.lineCap = 'round'
    outlineCtx.lineJoin = 'round'
    outlineCtxRef.current = outlineCtx

    // 保存初始状态
    saveToHistory()
  }, [])

  // 保存历史记录（双层）
  const saveToHistory = useCallback(() => {
    const fillCanvas = fillCanvasRef.current
    const outlineCanvas = outlineCanvasRef.current
    const fillCtx = fillCtxRef.current
    const outlineCtx = outlineCtxRef.current
    if (!fillCanvas || !outlineCanvas || !fillCtx || !outlineCtx) return

    const fillData = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height)
    const outlineData = outlineCtx.getImageData(0, 0, outlineCanvas.width, outlineCanvas.height)

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push({ fill: fillData, outline: outlineData })
      // 最多保存5步
      if (newHistory.length > 5) {
        newHistory.shift()
        return newHistory
      }
      return newHistory
    })
    setHistoryIndex((prev) => Math.min(prev + 1, 4))
  }, [historyIndex])

  // 撤销（双层）
  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const fillCtx = fillCtxRef.current
    const outlineCtx = outlineCtxRef.current
    if (!fillCtx || !outlineCtx) return

    const newIndex = historyIndex - 1
    fillCtx.putImageData(history[newIndex].fill, 0, 0)
    outlineCtx.putImageData(history[newIndex].outline, 0, 0)
    setHistoryIndex(newIndex)
  }, [history, historyIndex])

  // 重做（双层）
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const fillCtx = fillCtxRef.current
    const outlineCtx = outlineCtxRef.current
    if (!fillCtx || !outlineCtx) return

    const newIndex = historyIndex + 1
    fillCtx.putImageData(history[newIndex].fill, 0, 0)
    outlineCtx.putImageData(history[newIndex].outline, 0, 0)
    setHistoryIndex(newIndex)
  }, [history, historyIndex])

  // 绘制带抖动效果的线条
  const drawLine = useCallback((from: Point, to: Point) => {
    const ctx = brushMode === 'outline' ? outlineCtxRef.current : fillCtxRef.current
    if (!ctx) return

    const currentSize = brushMode === 'outline' ? outlineBrushSize : fillBrushSize
    ctx.strokeStyle = currentColor
    ctx.lineWidth = currentSize

    ctx.beginPath()

    // 添加轻微抖动，模拟手绘效果
    const wobbleIntensity = currentSize * 0.3
    const fromWobble = addWobble(from.x, from.y, wobbleIntensity)
    const toWobble = addWobble(to.x, to.y, wobbleIntensity)

    ctx.moveTo(fromWobble.x, fromWobble.y)

    // 使用二次贝塞尔曲线让线条更自然
    const midX = (fromWobble.x + toWobble.x) / 2
    const midY = (fromWobble.y + toWobble.y) / 2
    ctx.quadraticCurveTo(fromWobble.x, fromWobble.y, midX, midY)
    ctx.quadraticCurveTo(midX, midY, toWobble.x, toWobble.y)

    ctx.stroke()
  }, [brushMode, currentColor])

  // 开始绘制
  const startDrawing = useCallback((e: TouchEvent | MouseEvent) => {
    e.preventDefault()
    const canvas = fillCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const point = { x: clientX - rect.left, y: clientY - rect.top }
    lastPointRef.current = point
    setIsDrawing(true)

    // 画一个点
    const ctx = brushMode === 'outline' ? outlineCtxRef.current : fillCtxRef.current
    if (ctx) {
      const currentSize = brushMode === 'outline' ? outlineBrushSize : fillBrushSize
      ctx.fillStyle = currentColor
      ctx.beginPath()
      ctx.arc(point.x, point.y, currentSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [brushMode, currentColor])

  // 绘制中
  const draw = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDrawing) return
    e.preventDefault()

    const canvas = fillCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    const point = { x: clientX - rect.left, y: clientY - rect.top }
    if (lastPointRef.current) {
      drawLine(lastPointRef.current, point)
    }
    lastPointRef.current = point
  }, [isDrawing, drawLine])

  // 结束绘制
  const endDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false)
      lastPointRef.current = null
      // 如果是勾边模式，标记已画过勾边
      if (brushMode === 'outline') {
        setHasOutlineDrawn(true)
      }
      saveToHistory()
    }
  }, [isDrawing, brushMode, saveToHistory])

  // 绑定非被动触摸事件监听器以支持 preventDefault
  useEffect(() => {
    const canvas = outlineCanvasRef.current
    if (!canvas) return

    // 使用 { passive: false } 以允许 preventDefault
    canvas.addEventListener('touchstart', startDrawing, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', endDrawing)
    canvas.addEventListener('mousedown', startDrawing)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', endDrawing)
    canvas.addEventListener('mouseleave', endDrawing)

    return () => {
      canvas.removeEventListener('touchstart', startDrawing)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', endDrawing)
      canvas.removeEventListener('mousedown', startDrawing)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', endDrawing)
      canvas.removeEventListener('mouseleave', endDrawing)
    }
  }, [startDrawing, draw, endDrawing])

  // 清空画布（双层）
  const clearCanvas = useCallback(() => {
    const fillCanvas = fillCanvasRef.current
    const outlineCanvas = outlineCanvasRef.current
    const fillCtx = fillCtxRef.current
    const outlineCtx = outlineCtxRef.current
    if (!fillCanvas || !outlineCanvas || !fillCtx || !outlineCtx) return

    fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height)
    outlineCtx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height)
    setHasOutlineDrawn(false) // 重置勾边状态
    setBrushMode('outline') // 回到勾边模式
    setCurrentColor('#333333') // 重置颜色
    saveToHistory()
  }, [saveToHistory])

  // 获取绘制内容的边界框（合并两层）
  const getContentBounds = useCallback(() => {
    const fillCanvas = fillCanvasRef.current
    const outlineCanvas = outlineCanvasRef.current
    const fillCtx = fillCtxRef.current
    const outlineCtx = outlineCtxRef.current
    if (!fillCanvas || !outlineCanvas || !fillCtx || !outlineCtx) return null

    const fillData = fillCtx.getImageData(0, 0, fillCanvas.width, fillCanvas.height)
    const outlineData = outlineCtx.getImageData(0, 0, outlineCanvas.width, outlineCanvas.height)
    const { width, height } = fillData

    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let hasContent = false

    // 扫描两层的所有像素找到有内容的边界
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4 + 3
        const fillAlpha = fillData.data[idx]
        const outlineAlpha = outlineData.data[idx]
        if (fillAlpha > 0 || outlineAlpha > 0) {
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

  // 导出为PNG (合并两层：先填充层，再勾边层，勾边在最上面)
  const exportImage = useCallback((): string | null => {
    const fillCanvas = fillCanvasRef.current
    const outlineCanvas = outlineCanvasRef.current
    if (!fillCanvas || !outlineCanvas) return null

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

    // 先绘制填充层（底层）
    tempCtx.drawImage(
      fillCanvas,
      bounds.x, bounds.y, bounds.width, bounds.height,
      0, 0, outputWidth, outputHeight
    )

    // 再绘制勾边层（顶层）
    tempCtx.drawImage(
      outlineCanvas,
      bounds.x, bounds.y, bounds.width, bounds.height,
      0, 0, outputWidth, outputHeight
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
        {/* 笔触模式切换 */}
        <div className="flex gap-2">
          <motion.button
            onClick={() => {
              setBrushMode('outline')
              setCurrentColor(outlineColors[0])
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all hand-drawn-button ${
              brushMode === 'outline'
                ? 'bg-gray-800 text-white border-gray-900 shadow-lg'
                : 'bg-white border-2 border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            ✏️ 勾边
          </motion.button>
          <motion.button
            onClick={() => {
              if (hasOutlineDrawn) {
                setBrushMode('fill')
                setCurrentColor(fillPalette[0])
              }
            }}
            whileHover={hasOutlineDrawn ? { scale: 1.05 } : {}}
            whileTap={hasOutlineDrawn ? { scale: 0.95 } : {}}
            className={`px-4 py-2 rounded-2xl font-bold text-sm transition-all hand-drawn-button relative ${
              !hasOutlineDrawn
                ? 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed'
                : brushMode === 'fill'
                  ? 'bg-gradient-to-br from-pink-500 to-orange-400 text-white border-pink-600 shadow-lg'
                  : 'bg-white border-2 border-gray-300 text-gray-600 hover:border-pink-400'
            }`}
            title={!hasOutlineDrawn ? '请先用勾边画出轮廓' : ''}
          >
            🎨 填色
            {!hasOutlineDrawn && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-xs">
                🔒
              </span>
            )}
          </motion.button>
        </div>

        {/* 笔刷大小 - 固定 10px */}
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border-2 border-gray-300 shadow-md">
          <span className="text-xs font-bold text-gray-500">笔刷</span>
          <div
            className="rounded-full"
            style={{
              width: 10,
              height: 10,
              backgroundColor: brushMode === 'outline' ? '#333' : currentColor
            }}
          />
          <span className="text-sm font-bold text-gray-600">10px</span>
        </div>

        {/* 撤销/重做/清除 */}
        <div className="flex gap-2">
          <motion.button
            onClick={undo}
            disabled={historyIndex <= 0}
            whileHover={{ scale: 1.1, rotate: -10 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full bg-white border-2 border-blue-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 transition-all hand-drawn-button text-lg shadow-md"
          >
            ↩️
          </motion.button>
          <motion.button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full bg-white border-2 border-blue-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 transition-all hand-drawn-button text-lg shadow-md"
          >
            ↪️
          </motion.button>
          <motion.button
            onClick={clearCanvas}
            whileHover={{ scale: 1.15, rotate: -5 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full bg-white border-2 border-red-400 flex items-center justify-center hover:bg-red-50 transition-all hand-drawn-button text-lg shadow-md"
          >
            🗑️
          </motion.button>
        </div>
      </div>

      {/* 画布区域 - 双层 Canvas */}
      <div className="flex-1 relative bg-white" style={{ touchAction: 'none' }}>
        {/* 底层：填充层 */}
        <canvas
          ref={fillCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 1 }}
        />
        {/* 顶层：勾边层 */}
        <canvas
          ref={outlineCanvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ zIndex: 2, touchAction: 'none' }}
        />

        {/* 网格背景 (视觉参考) - 儿童画风格点状 */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle, #999 1px, transparent 1px)`,
            backgroundSize: '25px 25px',
            zIndex: 0,
          }}
        />

        {/* 画布装饰边框 */}
        <div className="absolute inset-2 pointer-events-none border-2 border-dashed border-purple-200 rounded-lg opacity-30" style={{ zIndex: 3 }} />

        {/* 当前模式提示 */}
        <div
          className="absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold pointer-events-none"
          style={{
            zIndex: 4,
            backgroundColor: brushMode === 'outline' ? 'rgba(0,0,0,0.7)' : 'rgba(236,72,153,0.8)',
            color: 'white'
          }}
        >
          {brushMode === 'outline'
            ? (hasOutlineDrawn ? '✏️ 勾边模式' : '✏️ 先画轮廓吧~')
            : '🎨 填色模式'}
        </div>
      </div>

      {/* 色板 - 根据模式显示不同颜色 */}
      <div className="flex items-center justify-center gap-3 p-4 pb-20 bg-gradient-to-r from-pink-50 via-yellow-50 to-blue-50 border-t-4 border-dashed border-purple-300">
        {/* 模式标签 */}
        <span className="text-sm font-bold text-gray-500 mr-2">
          {brushMode === 'outline' ? '勾边色' : '填充色'}
        </span>

        {(brushMode === 'outline' ? outlineColors : fillPalette).map((color) => (
          <motion.button
            key={color}
            onClick={() => setCurrentColor(color)}
            whileHover={{ scale: 1.3, rotate: 360, y: -8 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`${brushMode === 'outline' ? 'w-12 h-12' : 'w-10 h-10'} rounded-full border-4 transition-all relative hand-drawn-button ${
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
                className="absolute inset-0 flex items-center justify-center text-white text-xl font-bold"
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
