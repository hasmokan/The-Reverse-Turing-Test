import { create } from 'zustand'
import { GameState, GameItem, GamePhase, ThemeConfig, Comment } from '@/types'
import { fishTankTheme } from '@/config/themes'
import { generateId, randomRange, calculateTurbidity } from '@/lib/utils'

interface GameStore extends GameState {
  // Actions
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

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

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
    set(initialState)
  },

  syncState: (newState) => {
    set((state) => ({ ...state, ...newState }))
  },
}))
