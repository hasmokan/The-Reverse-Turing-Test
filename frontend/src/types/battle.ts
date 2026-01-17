/**
 * 战斗系统类型定义
 * 基于 PRD v2.0
 */

// 子弹状态
export interface BulletState {
  loaded: boolean
  cooldownEndTime: number | null
  currentTarget: string | null
}

// 单条鱼的票数信息
export interface FishVoteInfo {
  count: number
  voters: string[]
}

// 所有鱼的票数映射
export interface FishVotes {
  [fishId: string]: FishVoteInfo
}

// Toast 类型
export type ToastType = 'kill_ai' | 'kill_human' | 'self_caught' | 'being_attacked' | 'info'

// Toast 消息
export interface ToastMessage {
  id: string
  type: ToastType
  content: string
  createdAt: number
}

// 击杀/淘汰结果
export interface EliminationResult {
  fishId: string
  fishName: string
  isAI: boolean
  fishOwnerId: string
  killerNames: string[]
}

// 游戏结果
export interface GameResult {
  isVictory: boolean
  mvpPlayerId?: string
  mvpPlayerName?: string
  aiRemaining: number
  humanRemaining: number
}

// 漂浮伤害数字
export interface FloatingDamage {
  id: string
  fishId: string
  value: number
  x: number
  y: number
  createdAt: number
}

// 处决动画状态
export interface EliminationAnimation {
  fishId: string
  fishName: string
  isAI: boolean
  stage: 'grab' | 'pull' | 'done'
}

// 战斗相关的 WebSocket 事件类型
export type BattleWSEventType =
  | 'vote:cast'
  | 'vote:retract'
  | 'vote:chase'
  | 'vote:update'
  | 'vote:received'
  | 'fish:eliminate'
  | 'game:victory'
  | 'game:defeat'

// 投票事件数据 (前端 → 后端)
export interface VoteCastData {
  fishId: string
  voterId: string
}

export interface VoteRetractData {
  fishId: string
  voterId: string
}

export interface VoteChaseData {
  fishId: string
  voterId: string
}

// 投票更新事件数据 (后端 → 前端)
export interface VoteUpdateData {
  fishId: string
  count: number
  voters: string[]
}

// 被投票通知 (后端 → 前端)
export interface VoteReceivedData {
  fishId: string
  voterId: string
}

// 鱼被淘汰事件 (后端 → 前端)
export interface FishEliminateData {
  fishId: string
  fishName: string
  isAI: boolean
  fishOwnerId: string
  killerNames: string[]
}

// 游戏胜利事件 (后端 → 前端)
export interface GameVictoryData {
  mvpId: string
  mvpName: string
  aiRemaining: number
  humanRemaining: number
}

// 游戏失败事件 (后端 → 前端)
export interface GameDefeatData {
  aiRemaining: number
  humanRemaining: number
}
