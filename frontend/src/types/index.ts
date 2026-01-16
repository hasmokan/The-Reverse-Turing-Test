// 游戏物体类型
export interface GameItem {
  id: string
  imageUrl: string
  name: string
  description: string
  author: string
  isAI: boolean
  createdAt: number
  position: Position
  velocity: Velocity
  rotation: number
  scale: number
  flipX: boolean
}

export interface Position {
  x: number
  y: number
}

export interface Velocity {
  vx: number
  vy: number
}

// 主题配置类型
export interface ThemeConfig {
  theme_id: string
  theme_name: string
  assets: {
    background_url: string
    particle_effect?: string
  }
  palette: string[]
  ai_settings: {
    keywords: string[]
    prompt_style: string
  }
  game_rules: {
    spawn_rate: number
    max_imposters: number
  }
}

// 游戏状态
export type GamePhase = 'lobby' | 'drawing' | 'viewing' | 'voting' | 'result' | 'gameover'

export interface GameState {
  phase: GamePhase
  roomId: string | null
  totalItems: number
  aiCount: number
  votingTarget: GameItem | null
  votingEndTime: number | null
  votes: Record<string, number>
  theme: ThemeConfig | null
  items: GameItem[]
  turbidity: number // 0-1, 随 AI 数量增加
}

// 绘画状态
export interface DrawingState {
  brushSize: 1 | 2 | 3
  currentColor: string
  history: ImageData[]
  historyIndex: number
  maxHistory: number
}

// 投票
export interface VotePayload {
  itemId: string
  voterId: string
}

// WebSocket 事件
export type WSEventType =
  | 'room:join'
  | 'room:leave'
  | 'item:add'
  | 'item:remove'
  | 'item:update'
  | 'vote:cast'
  | 'vote:start'
  | 'vote:end'
  | 'game:over'
  | 'sync:state'
