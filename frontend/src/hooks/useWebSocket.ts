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
import { ENV_CONFIG } from '@/config/env'

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

// 生成随机速度 - 主要左右游动
function generateRandomVelocity(): { vx: number; vy: number } {
  const direction = Math.random() > 0.5 ? 1 : -1
  return {
    vx: direction * randomRange(0.8, 1.8), // 水平速度
    vy: randomRange(-0.3, 0.3),            // 轻微垂直浮动
  }
}

// 检查速度是否有效
function isValidVelocity(velocity: { vx: number; vy: number } | null | undefined): boolean {
  if (!velocity) return false
  if (typeof velocity.vx !== 'number' || typeof velocity.vy !== 'number') return false
  // 速度太小视为无效
  return Math.abs(velocity.vx) > 0.1 || Math.abs(velocity.vy) > 0.1
}

// 转换后端数据为前端格式
function convertBackendItem(item: BackendGameItem): GameItem {
  // 如果后端位置无效，前端生成随机位置
  const position = isValidPosition(item.position)
    ? item.position
    : generateRandomPosition()

  // 如果速度无效，生成随机速度（后端不存储速度，总是需要前端生成）
  const velocity = isValidVelocity(item.velocity)
    ? item.velocity
    : generateRandomVelocity()

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
    setIsSynced,
    // 战斗系统 actions
    updateFishVotes,
    clearFishVotes,
    setBeingAttacked,
    showToast,
    setGameResult,
    triggerElimination,
    playerFishId,
    addFloatingDamage,
  } = useGameStore()

  // 连接 WebSocket
  useEffect(() => {
    if (!enabled || !roomId) return

    // 重置同步状态
    setIsSynced(false)

    const socketUrl = url || ENV_CONFIG.WS_URL


    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    const socket = socketRef.current

    // 连接成功
    socket.on('connect', () => {
      // 加入房间 - 使用后端期望的格式
      socket.emit('room:join', { roomId })
    })

    // 同步状态 - 处理后端返回的完整状态
    socket.on('sync:state', (state: SyncStateResponse) => {

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

      // 标记同步完成
      setIsSynced(true)
    })

    // 新物品加入
    socket.on('item:add', (item: BackendGameItem) => {
      const converted = convertBackendItem(item)
      addItem(converted)
    })

    // 物品移除
    socket.on('item:remove', (data: { itemId: string }) => {
      removeItem(data.itemId)
    })

    // 开始投票
    socket.on('vote:start', (item: BackendGameItem) => {
      startVoting(convertBackendItem(item))
    })

    // 投票结束
    socket.on('vote:end', () => {
      endVoting()
    })

    // 收到投票更新 - 后端格式: { itemId, voteCount }
    socket.on('vote:cast', (data: { itemId: string; voteCount: number }) => {
      castVote(data.itemId)
    })

    // 游戏结束
    socket.on('game:over', () => {
      setGameOver()
    })

    // 收到评论 - 后端格式: { itemId, comment: { author, content } }
    socket.on('comment:add', (data: { itemId: string; comment: { author: string; content: string } }) => {
      addComment(data.itemId, data.comment)
    })

    // ==================== 战斗系统事件 ====================

    // 票数更新
    socket.on('vote:update', (data: VoteUpdateData) => {

      // 获取鱼的当前位置，显示 +1 动画
      const targetFish = useGameStore.getState().items.find(item => item.id === data.fishId)
      if (targetFish) {
        // 在鱼的位置显示 +1 漂浮伤害
        addFloatingDamage(
          data.fishId,
          targetFish.position.x,
          targetFish.position.y,
          1
        )
      }

      updateFishVotes(data.fishId, data.count, data.voters)
    })

    // 被投票通知（自己的鱼被投票）
    socket.on('vote:received', (data: VoteReceivedData) => {
      // 检查是否是自己的鱼
      if (data.fishId === playerFishId) {
        setBeingAttacked(true)
        showToast('being_attacked', '⚠️ 有人在瞄准你！')
      }
    })

    // 鱼被淘汰
    socket.on('fish:eliminate', (data: FishEliminateData) => {

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
      setGameResult({
        isVictory: false,
        aiRemaining: data.aiRemaining,
        humanRemaining: data.humanRemaining,
        humanKilled: data.humanKilled,
        reason: data.reason,
      })
    })

    // 断开连接
    socket.on('disconnect', () => {
    })

    // 连接错误
    socket.on('connect_error', (err) => {
    })

    return () => {
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
    setIsSynced,
    // 战斗系统
    updateFishVotes,
    clearFishVotes,
    setBeingAttacked,
    showToast,
    setGameResult,
    triggerElimination,
    playerFishId,
    addFloatingDamage,
  ])

  // 发送事件
  const emit = useCallback((event: WSEventType, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    } else {
    }
  }, [])

  // 提交作品 - 通过 REST API 而非 WebSocket
  const submitItem = useCallback(
    (item: Omit<GameItem, 'id' | 'position' | 'velocity' | 'rotation' | 'scale' | 'flipX'>) => {
      // 注意: 作品提交应该通过 REST API，不是 WebSocket
      // 后端会在数据库插入后通过 WebSocket 广播
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
