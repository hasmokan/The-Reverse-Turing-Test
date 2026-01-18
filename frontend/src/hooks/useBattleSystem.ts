'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/store'
import { WSEventType } from '@/types'
import {
  COOLDOWN_DURATION,
  ELIMINATION_THRESHOLD,
  VICTORY_CONDITION,
  DEFEAT_CONDITION,
} from '@/lib/battleConstants'
import { generateAttackWarning, generateSelfCaughtToast } from '@/lib/toastMessages'

interface UseBattleSystemOptions {
  emit?: (event: WSEventType, data?: unknown) => void
}

export function useBattleSystem({ emit }: UseBattleSystemOptions = {}) {
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const {
    bullet,
    fishVotes,
    playerId,
    playerFishId,
    items,
    aiCount,
    fireBullet,
    reloadBullet,
    changeTarget,
    chaseFire,
    updateFishVotes,
    showToast,
    setBeingAttacked,
    setGameResult,
    addFloatingDamage,
  } = useGameStore()

  // 清理定时器
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current)
      }
    }
  }, [])

  // 检查是否可以投票
  const canVote = useCallback(() => {
    return bullet.loaded
  }, [bullet.loaded])

  // 检查是否已经投票给某个目标
  const hasVotedFor = useCallback(
    (fishId: string) => {
      return bullet.currentTarget === fishId
    },
    [bullet.currentTarget]
  )

  // 检查是否可以追击
  const canChase = useCallback(
    (fishId: string) => {
      // 追击条件：当前目标就是这个鱼，且 CD 结束
      return bullet.currentTarget === fishId && bullet.loaded
    },
    [bullet.currentTarget, bullet.loaded]
  )

  // 检查是否可以换目标
  const canChangeTarget = useCallback(
    (newFishId: string) => {
      // 换目标条件：已有目标，且新目标不同于当前目标
      return bullet.currentTarget !== null && bullet.currentTarget !== newFishId
    },
    [bullet.currentTarget]
  )

  // 投票/开火
  const vote = useCallback(
    (fishId: string, position?: { x: number; y: number }) => {
      if (!canVote()) {
        return false
      }

      // 开火
      fireBullet(fishId)

      // 显示漂浮 +1
      if (position) {
        addFloatingDamage(fishId, position.x, position.y)
      }

      // 发送投票事件到后端
      if (emit) {
        emit('vote:cast', { fishId, voterId: playerId })
      }

      return true
    },
    [canVote, fireBullet, addFloatingDamage, emit, playerId]
  )

  // 换目标
  const switchTarget = useCallback(
    (newFishId: string, position?: { x: number; y: number }) => {
      const oldTarget = bullet.currentTarget

      if (!oldTarget || oldTarget === newFishId) {
        return false
      }

      // 换目标（内部会撤票）
      changeTarget(newFishId)

      // 显示漂浮 +1
      if (position) {
        addFloatingDamage(newFishId, position.x, position.y)
      }

      // 发送撤票 + 新投票事件
      if (emit) {
        emit('vote:retract', { fishId: oldTarget, voterId: playerId })
        emit('vote:cast', { fishId: newFishId, voterId: playerId })
      }

      return true
    },
    [bullet.currentTarget, changeTarget, addFloatingDamage, emit, playerId]
  )

  // 追击
  const chase = useCallback(
    (fishId: string) => {
      if (!canChase(fishId)) {
        return false
      }

      // 重置 CD（票数不变）
      chaseFire(fishId)

      // 发送追击事件
      if (emit) {
        emit('vote:chase', { fishId, voterId: playerId })
      }

      return true
    },
    [canChase, chaseFire, emit, playerId]
  )

  // 获取鱼的当前票数
  const getVoteCount = useCallback(
    (fishId: string) => {
      return fishVotes[fishId]?.count || 0
    },
    [fishVotes]
  )

  // 获取投票者列表
  const getVoters = useCallback(
    (fishId: string) => {
      return fishVotes[fishId]?.voters || []
    },
    [fishVotes]
  )

  // 处理被投票通知
  const handleVoteReceived = useCallback(
    (fishId: string) => {
      // 检查是否是自己的鱼
      if (fishId === playerFishId) {
        setBeingAttacked(true)
        showToast('being_attacked', generateAttackWarning())
      }
    },
    [playerFishId, setBeingAttacked, showToast]
  )

  // 检查胜负条件
  const checkGameEnd = useCallback(() => {
    const humanCount = items.filter((item) => !item.isAI).length

    // 胜利条件：AI 全部清除
    if (aiCount === 0 && humanCount >= VICTORY_CONDITION.minHumanCount) {
      setGameResult({
        isVictory: true,
        aiRemaining: 0,
        humanRemaining: humanCount,
      })
      return 'victory'
    }

    // 失败条件：AI 数量超过阈值
    if (aiCount > DEFEAT_CONDITION.maxAiCount) {
      setGameResult({
        isVictory: false,
        aiRemaining: aiCount,
        humanRemaining: humanCount,
      })
      return 'defeat'
    }

    return null
  }, [items, aiCount, setGameResult])

  // 判断操作类型
  const getActionType = useCallback(
    (fishId: string): 'vote' | 'chase' | 'switch' | 'disabled' => {
      // 没有子弹且没有当前目标
      if (!bullet.loaded && !bullet.currentTarget) {
        return 'disabled'
      }

      // 当前目标就是这个鱼
      if (bullet.currentTarget === fishId) {
        // 子弹装填好了可以追击
        if (bullet.loaded) {
          return 'chase'
        }
        // 还在 CD 中
        return 'disabled'
      }

      // 有其他目标，可以换目标
      if (bullet.currentTarget && bullet.currentTarget !== fishId) {
        return 'switch'
      }

      // 子弹装好了可以投票
      if (bullet.loaded) {
        return 'vote'
      }

      return 'disabled'
    },
    [bullet.loaded, bullet.currentTarget]
  )

  // 获取操作按钮文案
  const getActionText = useCallback(
    (fishId: string): string => {
      const actionType = getActionType(fishId)
      switch (actionType) {
        case 'vote':
          return '就是它！'
        case 'chase':
          return '追击！'
        case 'switch':
          return '投票放逐'
        case 'disabled':
        default:
          return '冷却中...'
      }
    },
    [getActionType]
  )

  // 执行操作
  const executeAction = useCallback(
    (fishId: string, position?: { x: number; y: number }) => {
      const actionType = getActionType(fishId)

      switch (actionType) {
        case 'vote':
          return vote(fishId, position)
        case 'chase':
          return chase(fishId)
        case 'switch':
          return switchTarget(fishId, position)
        case 'disabled':
        default:
          return false
      }
    },
    [getActionType, vote, chase, switchTarget]
  )

  return {
    // 状态
    bullet,
    fishVotes,
    canVote: canVote(),
    currentTarget: bullet.currentTarget,

    // 查询方法
    hasVotedFor,
    canChase,
    canChangeTarget,
    getVoteCount,
    getVoters,
    getActionType,
    getActionText,

    // 操作方法
    vote,
    chase,
    switchTarget,
    executeAction,

    // 事件处理
    handleVoteReceived,
    checkGameEnd,
  }
}

export default useBattleSystem
