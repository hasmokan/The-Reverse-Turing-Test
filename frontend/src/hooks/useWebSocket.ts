'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameStore } from '@/lib/store'
import { GameItem, WSEventType } from '@/types'

interface UseWebSocketOptions {
  url?: string
  roomId: string
  enabled?: boolean
}

export function useWebSocket({ url, roomId, enabled = true }: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const { addItem, removeItem, syncState, startVoting, endVoting, castVote, setGameOver } =
    useGameStore()

  // 连接 WebSocket
  useEffect(() => {
    if (!enabled || !roomId) return

    const socketUrl = url || process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'

    socketRef.current = io(socketUrl, {
      query: { roomId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    const socket = socketRef.current

    // 连接成功
    socket.on('connect', () => {
      console.log('[WS] Connected to server')
      socket.emit('room:join', { roomId })
    })

    // 同步状态
    socket.on('sync:state', (state) => {
      console.log('[WS] Sync state:', state)
      syncState(state)
    })

    // 新物品加入
    socket.on('item:add', (item: GameItem) => {
      console.log('[WS] Item added:', item)
      addItem(item)
    })

    // 物品移除
    socket.on('item:remove', (itemId: string) => {
      console.log('[WS] Item removed:', itemId)
      removeItem(itemId)
    })

    // 开始投票
    socket.on('vote:start', (item: GameItem) => {
      console.log('[WS] Voting started for:', item)
      startVoting(item)
    })

    // 投票结束
    socket.on('vote:end', () => {
      console.log('[WS] Voting ended')
      endVoting()
    })

    // 收到投票
    socket.on('vote:cast', (itemId: string) => {
      castVote(itemId)
    })

    // 游戏结束
    socket.on('game:over', () => {
      console.log('[WS] Game over!')
      setGameOver()
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
      socket.emit('room:leave', { roomId })
      socket.disconnect()
    }
  }, [url, roomId, enabled, addItem, removeItem, syncState, startVoting, endVoting, castVote, setGameOver])

  // 发送事件
  const emit = useCallback((event: WSEventType, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data)
    }
  }, [])

  // 提交作品
  const submitItem = useCallback(
    (item: Omit<GameItem, 'id' | 'position' | 'velocity' | 'rotation' | 'scale' | 'flipX'>) => {
      emit('item:add', item)
    },
    [emit]
  )

  // 发起投票
  const initiateVote = useCallback(
    (itemId: string) => {
      emit('vote:cast', { itemId })
    },
    [emit]
  )

  return {
    socket: socketRef.current,
    emit,
    submitItem,
    initiateVote,
    isConnected: socketRef.current?.connected ?? false,
  }
}

export default useWebSocket
