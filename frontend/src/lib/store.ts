import { create } from 'zustand'
import { GameState, GameItem, GamePhase, ThemeConfig, Comment } from '@/types'
import {
  BulletState,
  FishVotes,
  ToastMessage,
  ToastType,
  GameResult,
  EliminationAnimation,
  FloatingDamage,
} from '@/types/battle'
import { fishTankTheme } from '@/config/themes'
import { generateId, randomRange, calculateTurbidity } from '@/lib/utils'
import { COOLDOWN_DURATION, MAX_TOAST_COUNT, ELIMINATION_THRESHOLD } from '@/lib/battleConstants'

interface GameStore extends GameState {
  // 战斗系统状态
  bullet: BulletState
  fishVotes: FishVotes
  playerId: string | null
  playerFishId: string | null
  toasts: ToastMessage[]
  isBeingAttacked: boolean
  attackWarningEndTime: number | null
  gameResult: GameResult | null
  eliminationAnimation: EliminationAnimation | null
  floatingDamages: FloatingDamage[]

  // 原有 Actions
  setPhase: (phase: GamePhase) => void
  setRoomId: (roomId: string) => void
  setTheme: (theme: ThemeConfig) => void
  addItem: (item: Omit<GameItem, 'id' | 'position' | 'velocity' | 'rotation' | 'scale' | 'flipX' | 'comments'>) => void
  removeItem: (itemId: string) => void
  updateItemPosition: (itemId: string, x: number, y: number) => void
  updateItem: (itemId: string, updates: Partial<GameItem>) => void
  addComment: (itemId: string, comment: Omit<Comment, 'id' | 'createdAt'>) => void
  startVoting: (item: GameItem) => void
  endVoting: () => void
  castVote: (itemId: string) => void
  setGameOver: () => void
  resetGame: () => void
  syncState: (state: Partial<GameState>) => void

  // 战斗系统 Actions
  setPlayerId: (playerId: string) => void
  setPlayerFishId: (fishId: string) => void

  // 子弹相关
  fireBullet: (targetId: string) => void
  reloadBullet: () => void
  startCooldown: () => void
  changeTarget: (newTargetId: string) => void
  chaseFire: (targetId: string) => void

  // 票数相关
  updateFishVotes: (fishId: string, count: number, voters: string[]) => void
  clearFishVotes: (fishId: string) => void

  // Toast 相关
  showToast: (type: ToastType, content: string) => void
  removeToast: (id: string) => void

  // 攻击警告
  setBeingAttacked: (isAttacked: boolean, duration?: number) => void

  // 游戏结果
  setGameResult: (result: GameResult) => void
  clearGameResult: () => void

  // 处决动画
  triggerElimination: (fishId: string, fishName: string, isAI: boolean) => void
  clearEliminationAnimation: () => void

  // 漂浮伤害
  addFloatingDamage: (fishId: string, x: number, y: number, value?: number) => void
  removeFloatingDamage: (id: string) => void
}

const initialState: GameState = {
  phase: 'lobby',
  roomId: null,
  totalItems: 0,
  aiCount: 0,
  votingTarget: null,
  votingEndTime: null,
  votes: {},
  theme: fishTankTheme,
  items: [],
  turbidity: 0,
}

// 战斗系统初始状态
const initialBattleState = {
  bullet: {
    loaded: true,
    cooldownEndTime: null,
    currentTarget: null,
  } as BulletState,
  fishVotes: {} as FishVotes,
  playerId: null as string | null,
  playerFishId: null as string | null,
  toasts: [] as ToastMessage[],
  isBeingAttacked: false,
  attackWarningEndTime: null as number | null,
  gameResult: null as GameResult | null,
  eliminationAnimation: null as EliminationAnimation | null,
  floatingDamages: [] as FloatingDamage[],
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  ...initialBattleState,

  setPhase: (phase) => set({ phase }),

  setRoomId: (roomId) => set({ roomId }),

  setTheme: (theme) => set({ theme }),

  addItem: (itemData) => {
    // 随机选择向左或向右游动
    const direction = Math.random() > 0.5 ? 1 : -1
    const newItem: GameItem = {
      ...itemData,
      id: generateId(),
      position: {
        x: randomRange(80, 320),
        y: randomRange(80, 400),
      },
      velocity: {
        vx: direction * randomRange(0.8, 1.5), // 主要水平移动
        vy: randomRange(-0.2, 0.2), // 轻微垂直移动
      },
      rotation: randomRange(-5, 5),
      scale: randomRange(0.8, 1.2),
      flipX: direction < 0, // 根据移动方向决定朝向
      comments: [], // 初始化空评论列表
    }

    set((state) => {
      const newItems = [...state.items, newItem]
      const newAICount = state.aiCount + (itemData.isAI ? 1 : 0)
      const maxAI = state.theme?.game_rules.max_imposters || 5

      return {
        items: newItems,
        totalItems: newItems.length,
        aiCount: newAICount,
        turbidity: calculateTurbidity(newAICount, maxAI),
      }
    })
  },

  removeItem: (itemId) => {
    set((state) => {
      const item = state.items.find((i) => i.id === itemId)
      const newItems = state.items.filter((i) => i.id !== itemId)
      const newAICount = item?.isAI ? state.aiCount - 1 : state.aiCount
      const maxAI = state.theme?.game_rules.max_imposters || 5

      return {
        items: newItems,
        totalItems: newItems.length,
        aiCount: newAICount,
        turbidity: calculateTurbidity(newAICount, maxAI),
      }
    })
  },

  updateItemPosition: (itemId, x, y) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, position: { x, y } } : item
      ),
    }))
  },

  updateItem: (itemId, updates) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }))
  },

  addComment: (itemId, commentData) => {
    const newComment = {
      ...commentData,
      id: generateId(),
      createdAt: Date.now(),
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? { ...item, comments: [...item.comments, newComment] }
          : item
      ),
    }))
  },

  startVoting: (item) => {
    set({
      phase: 'voting',
      votingTarget: item,
      votingEndTime: Date.now() + 60000, // 60秒
      votes: { [item.id]: 0 },
    })
  },

  endVoting: () => {
    const { votingTarget, votes, items } = get()
    if (!votingTarget) return

    const voteCount = votes[votingTarget.id] || 0
    const threshold = Math.ceil(items.length * 0.3) // 30% 在线人数

    if (voteCount >= threshold) {
      // 淘汰成功
      get().removeItem(votingTarget.id)
    }

    set({
      phase: 'viewing',
      votingTarget: null,
      votingEndTime: null,
      votes: {},
    })
  },

  castVote: (itemId) => {
    set((state) => ({
      votes: {
        ...state.votes,
        [itemId]: (state.votes[itemId] || 0) + 1,
      },
    }))
  },

  setGameOver: () => {
    set({ phase: 'gameover' })
  },

  resetGame: () => {
    set({ ...initialState, ...initialBattleState })
  },

  syncState: (newState) => {
    set((state) => ({ ...state, ...newState }))
  },

  // ==================== 战斗系统 Actions ====================

  setPlayerId: (playerId) => set({ playerId }),

  setPlayerFishId: (fishId) => set({ playerFishId: fishId }),

  // 开火 - 消耗子弹，开始 CD
  fireBullet: (targetId) => {
    const { bullet } = get()
    if (!bullet.loaded) return

    set({
      bullet: {
        loaded: false,
        cooldownEndTime: Date.now() + COOLDOWN_DURATION,
        currentTarget: targetId,
      },
    })
  },

  // 装弹 - CD 结束时调用
  reloadBullet: () => {
    set({
      bullet: {
        loaded: true,
        cooldownEndTime: null,
        currentTarget: get().bullet.currentTarget, // 保持当前目标
      },
    })
  },

  // 开始 CD
  startCooldown: () => {
    set((state) => ({
      bullet: {
        ...state.bullet,
        loaded: false,
        cooldownEndTime: Date.now() + COOLDOWN_DURATION,
      },
    }))
  },

  // 换目标 - 撤回当前目标的票，投给新目标
  changeTarget: (newTargetId) => {
    const { bullet, fishVotes, playerId } = get()
    const oldTargetId = bullet.currentTarget

    // 更新本地 fishVotes（撤票）
    if (oldTargetId && fishVotes[oldTargetId]) {
      const oldVotes = fishVotes[oldTargetId]
      set((state) => ({
        fishVotes: {
          ...state.fishVotes,
          [oldTargetId]: {
            count: Math.max(0, oldVotes.count - 1),
            voters: oldVotes.voters.filter((v) => v !== playerId),
          },
        },
        bullet: {
          ...state.bullet,
          currentTarget: newTargetId,
        },
      }))
    } else {
      set((state) => ({
        bullet: {
          ...state.bullet,
          currentTarget: newTargetId,
        },
      }))
    }
  },

  // 追击 - 重置 CD，但票数不变
  chaseFire: (targetId) => {
    set({
      bullet: {
        loaded: false,
        cooldownEndTime: Date.now() + COOLDOWN_DURATION,
        currentTarget: targetId,
      },
    })
  },

  // 更新鱼的票数
  updateFishVotes: (fishId, count, voters) => {
    set((state) => ({
      fishVotes: {
        ...state.fishVotes,
        [fishId]: { count, voters },
      },
    }))

    // 检查是否达到处决阈值
    if (count >= ELIMINATION_THRESHOLD) {
      const item = get().items.find((i) => i.id === fishId)
      if (item) {
        get().triggerElimination(fishId, item.name, item.isAI)
      }
    }
  },

  // 清除鱼的票数
  clearFishVotes: (fishId) => {
    set((state) => {
      const newFishVotes = { ...state.fishVotes }
      delete newFishVotes[fishId]
      return { fishVotes: newFishVotes }
    })
  },

  // 显示 Toast
  showToast: (type, content) => {
    const newToast: ToastMessage = {
      id: generateId(),
      type,
      content,
      createdAt: Date.now(),
    }

    set((state) => {
      // 限制最大数量，移除最旧的
      const newToasts = [newToast, ...state.toasts].slice(0, MAX_TOAST_COUNT)
      return { toasts: newToasts }
    })
  },

  // 移除 Toast
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  // 设置被攻击状态
  setBeingAttacked: (isAttacked, duration = 5000) => {
    if (isAttacked) {
      set({
        isBeingAttacked: true,
        attackWarningEndTime: Date.now() + duration,
      })
    } else {
      set({
        isBeingAttacked: false,
        attackWarningEndTime: null,
      })
    }
  },

  // 设置游戏结果
  setGameResult: (result) => {
    set({
      gameResult: result,
      phase: 'gameover',
    })
  },

  // 清除游戏结果
  clearGameResult: () => {
    set({ gameResult: null })
  },

  // 触发处决动画
  triggerElimination: (fishId, fishName, isAI) => {
    set({
      eliminationAnimation: {
        fishId,
        fishName,
        isAI,
        stage: 'grab',
      },
    })
  },

  // 清除处决动画
  clearEliminationAnimation: () => {
    set({ eliminationAnimation: null })
  },

  // 添加漂浮伤害数字
  addFloatingDamage: (fishId, x, y, value = 1) => {
    const newDamage: FloatingDamage = {
      id: generateId(),
      fishId,
      value,
      x,
      y,
      createdAt: Date.now(),
    }

    set((state) => ({
      floatingDamages: [...state.floatingDamages, newDamage],
    }))
  },

  // 移除漂浮伤害数字
  removeFloatingDamage: (id) => {
    set((state) => ({
      floatingDamages: state.floatingDamages.filter((d) => d.id !== id),
    }))
  },
}))
