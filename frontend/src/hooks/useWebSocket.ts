'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameStore } from '@/lib/store'
import { GameItem, WSEventType, Comment, ThemeConfig } from '@/types'
import {
  VoteUpdateData,
  VoteReceivedData,
  FishEliminateData,
  GameVictoryData,
  GameDefeatData,
} from '@/types/battle'
import { convertThemeResponse, ThemeResponse } from '@/lib/api'
import { generateKillToast, generateSelfCaughtToast } from '@/lib/toastMessages'

interface UseWebSocketOptions {
  url?: string
  roomId: string
  enabled?: boolean
}

// 后端 sync:state 响应格式
interface SyncStateResponse {
  phase: string
  roomId: string
  totalItems: number
  aiCount: number
  turbidity: number
  theme: ThemeResponse
  items: BackendGameItem[]
}

// 后端返回的 GameItem 格式
interface BackendGameItem {
  id: string
  imageUrl: string
  name: string
  description: string
  author: string
  isAI: boolean
  createdAt: number
  position: { x: number; y: number }
  velocity: { vx: number; vy: number }
  rotation: number
  scale: number
  flipX: boolean
  comments: Comment[]
}

// 生成随机范围内的值
function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// 检查位置是否有效（非零、非 null）
function isValidPosition(position: { x: number; y: number } | null | undefined): boolean {
  if (!position) return false
  // 如果 x 和 y 都接近 0，视为无效位置
  return !(Math.abs(position.x) < 1 && Math.abs(position.y) < 1)
}

// 生成随机位置（在画布有效范围内）
function generateRandomPosition(): { x: number; y: number } {
  // 使用合理的默认画布范围，实际边界由 GameStage 动态处理
  return {
    x: randomRange(80, 320),
    y: randomRange(80, 400),
  }
}

// 生成随机速度
function generateRandomVelocity(): { vx: number; vy: number } {
  const direction = Math.random() > 0.5 ? 1 : -1
  return {
    vx: direction * randomRange(0.8, 1.5),
    vy: randomRange(-0.2, 0.2),
  }
}

// 转换后端数据为前端格式
function convertBackendItem(item: BackendGameItem): GameItem {
  // 如果后端位置无效，前端生成随机位置
  const position = isValidPosition(item.position)
    ? item.position
    : generateRandomPosition()

  // 如果速度无效，生成随机速度
  const hasValidVelocity = item.velocity && (item.velocity.vx !== 0 || item.velocity.vy !== 0)
  const velocity = hasValidVelocity ? item.velocity : generateRandomVelocity()

  // 根据速度方向确定朝向
  const flipX = velocity.vx < 0

  return {
    id: item.id,
    imageUrl: item.imageUrl,
    name: item.name,
    description: item.description,
    author: item.author,
    isAI: item.isAI,
    createdAt: item.createdAt,
    position,
    velocity,
    rotation: item.rotation || randomRange(-5, 5),
    scale: item.scale || randomRange(0.8, 1.2),
    flipX,
    comments: item.comments || [],
  }
}

export function useWebSocket({ url, roomId, enabled = true }: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const {
    addItem,
    removeItem,
    syncState,
    startVoting,
    endVoting,
    castVote,
    setGameOver,
    addComment,
    setTheme,
    setRoomId,
    setPhase,
    // 战斗系统 actions
    updateFishVotes,
    clearFishVotes,
    setBeingAttacked,
    showToast,
    setGameResult,
    triggerElimination,
    playerFishId,
  } = useGameStore()

  // 连接 WebSocket
  useEffect(() => {
    if (!enabled || !roomId) return

    const socketUrl = url || process.env.NEXT_PUBLIC_WS_URL || ''

    console.log('[WS] Connecting to:', socketUrl, 'Room:', roomId)

    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    const socket = socketRef.current

    // 连接成功
    socket.on('connect', () => {
      console.log('[WS] Connected to server')
      // 加入房间 - 使用后端期望的格式
      socket.emit('room:join', { roomId })
    })

    // 同步状态 - 处理后端返回的完整状态
    socket.on('sync:state', (state: SyncStateResponse) => {
      console.log('[WS] Sync state received:', state)

      // 转换主题格式
      const theme = convertThemeResponse(state.theme)

      // 转换 items 格式
      const items = state.items.map(convertBackendItem)

      // 更新 store
      setTheme(theme as ThemeConfig)
      setRoomId(state.roomId)
      setPhase(state.phase as 'lobby' | 'drawing' | 'viewing' | 'voting' | 'result' | 'gameover')
      syncState({
        totalItems: state.totalItems,
        aiCount: state.aiCount,
        turbidity: state.turbidity,
        items,
      })
    })

    // 新物品加入
    socket.on('item:add', (item: BackendGameItem) => {
      console.log('[WS] Item added:', item)
      const converted = convertBackendItem(item)
      addItem(converted)
    })

    // 物品移除
    socket.on('item:remove', (data: { itemId: string }) => {
      console.log('[WS] Item removed:', data.itemId)
      removeItem(data.itemId)
    })

    // 开始投票
    socket.on('vote:start', (item: BackendGameItem) => {
      console.log('[WS] Voting started for:', item)
      startVoting(convertBackendItem(item))
    })

    // 投票结束
    socket.on('vote:end', () => {
      console.log('[WS] Voting ended')
      endVoting()
    })

    // 收到投票更新 - 后端格式: { itemId, voteCount }
    socket.on('vote:cast', (data: { itemId: string; voteCount: number }) => {
      console.log('[WS] Vote update:', data)
      castVote(data.itemId)
    })

    // 游戏结束
    socket.on('game:over', () => {
      console.log('[WS] Game over!')
      setGameOver()
    })

    // 收到评论 - 后端格式: { itemId, comment: { author, content } }
    socket.on('comment:add', (data: { itemId: string; comment: { author: string; content: string } }) => {
      console.log('[WS] Comment added:', data)
      addComment(data.itemId, data.comment)
    })

    // ==================== 战斗系统事件 ====================

    // 票数更新
    socket.on('vote:update', (data: VoteUpdateData) => {
      console.log('[WS] Vote update:', data)
      updateFishVotes(data.fishId, data.count, data.voters)
    })

    // 被投票通知（自己的鱼被投票）
    socket.on('vote:received', (data: VoteReceivedData) => {
      console.log('[WS] Vote received:', data)
      // 检查是否是自己的鱼
      if (data.fishId === playerFishId) {
        setBeingAttacked(true)
        showToast('being_attacked', '⚠️ 有人在瞄准你！')
      }
    })

    // 鱼被淘汰
    socket.on('fish:eliminate', (data: FishEliminateData) => {
      console.log('[WS] Fish eliminated:', data)

      // 触发处决动画
      triggerElimination(data.fishId, data.fishName, data.isAI)

      // 如果是自己的鱼被淘汰
      if (data.fishOwnerId === playerFishId) {
        showToast('self_caught', generateSelfCaughtToast(data.fishName))
      } else {
        // 显示击杀 Toast
        const toastContent = generateKillToast(data.fishName, data.isAI)
        showToast(data.isAI ? 'kill_ai' : 'kill_human', toastContent)
      }

      // 清除票数记录
      clearFishVotes(data.fishId)

      // 移除鱼（由 GrabEffect 组件处理，这里延迟执行）
      // removeItem(data.fishId) - 由 GrabEffect 处理
    })

    // 游戏胜利
    socket.on('game:victory', (data: GameVictoryData) => {
      console.log('[WS] Game victory:', data)
      setGameResult({
        isVictory: true,
        mvpPlayerId: data.mvpId,
        mvpPlayerName: data.mvpName,
        aiRemaining: data.aiRemaining,
        humanRemaining: data.humanRemaining,
      })
    })

    // 游戏失败
    socket.on('game:defeat', (data: GameDefeatData) => {
      console.log('[WS] Game defeat:', data)
      setGameResult({
        isVictory: false,
        aiRemaining: data.aiRemaining,
        humanRemaining: data.humanRemaining,
      })
    })

    // 断开连接
    socket.on('disconnect', () => {
      console.log('[WS] Disconnected from server')
    })

    // 连接错误
    socket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err)
    })

    return () => {
      console.log('[WS] Leaving room:', roomId)
      socket.emit('room:leave', { roomId })
      socket.disconnect()
    }
  }, [
    url,
    roomId,
    enabled,
    addItem,
    removeItem,
    syncState,
    startVoting,
    endVoting,
    castVote,
    setGameOver,
    addComment,
    setTheme,
    setRoomId,
    setPhase,
    // 战斗系统
    updateFishVotes,
    clearFishVotes,
    setBeingAttacked,
    showToast,
    setGameResult,
    triggerElimination,
    playerFishId,
  ])

  // 发送事件
  const emit = useCallback((event: WSEventType, data?: unknown) => {
    if (socketRef.current?.connected) {
      console.log('[WS] Emit:', event, data)
      socketRef.current.emit(event, data)
    } else {
      console.warn('[WS] Not connected, cannot emit:', event)
    }
  }, [])

  // 提交作品 - 通过 REST API 而非 WebSocket
  const submitItem = useCallback(
    (item: Omit<GameItem, 'id' | 'position' | 'velocity' | 'rotation' | 'scale' | 'flipX'>) => {
      // 注意: 作品提交应该通过 REST API，不是 WebSocket
      // 后端会在数据库插入后通过 WebSocket 广播
      console.log('[WS] Item submission should use REST API, not WebSocket')
    },
    []
  )

  // 发起投票 - 使用后端期望的格式
  const initiateVote = useCallback(
    (itemId: string) => {
      emit('vote:cast', { itemId })
    },
    [emit]
  )

  // 提交评论 - 使用后端期望的格式
  const submitComment = useCallback(
    (itemId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => {
      emit('comment:add', { itemId, comment })
    },
    [emit]
  )

  // ==================== 战斗系统方法 ====================

  // 投票
  const battleVote = useCallback(
    (fishId: string, voterId: string) => {
      emit('vote:cast', { fishId, voterId })
    },
    [emit]
  )

  // 撤票
  const retractVote = useCallback(
    (fishId: string, voterId: string) => {
      emit('vote:retract', { fishId, voterId })
    },
    [emit]
  )

  // 追击
  const chaseVote = useCallback(
    (fishId: string, voterId: string) => {
      emit('vote:chase', { fishId, voterId })
    },
    [emit]
  )

  return {
    socket: socketRef.current,
    emit,
    submitItem,
    initiateVote,
    submitComment,
    // 战斗系统
    battleVote,
    retractVote,
    chaseVote,
    isConnected: socketRef.current?.connected ?? false,
  }
}

export default useWebSocket
