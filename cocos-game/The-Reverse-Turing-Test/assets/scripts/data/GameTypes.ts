/**
 * 游戏类型定义
 * 迁移自: frontend/src/types/index.ts 和 frontend/src/types/battle.ts
 */

// ==================== 游戏阶段 ====================

export enum GamePhase {
    LOBBY = 'lobby',
    DRAWING = 'drawing',
    VIEWING = 'viewing',
    VOTING = 'voting',
    RESULT = 'result',
    GAMEOVER = 'gameover'
}

// ==================== 游戏物品 (鱼) ====================

export interface Position {
    x: number;
    y: number;
}

export interface Velocity {
    vx: number;
    vy: number;
}

export interface Comment {
    id: string;
    author: string;
    content: string;
    createdAt: number;
}

export interface GameItem {
    id: string;
    imageUrl: string;          // Base64 图片数据
    name: string;
    description: string;
    author: string;
    isAI: boolean;
    createdAt: number;
    position: Position;
    velocity: Velocity;
    rotation: number;
    scale: number;
    flipX: boolean;
    comments: Comment[];
}

// ==================== 主题配置 ====================

export interface ThemeAssets {
    backgroundUrl: string;
    particleEffect?: string;
}

export interface ThemeAISettings {
    keywords: string[];
    promptStyle: string;
}

export interface ThemeGameRules {
    spawnRate: number;
    maxImposters: number;
}

export interface ThemeConfig {
    themeId: string;
    themeName: string;
    assets: ThemeAssets;
    palette: string[];
    aiSettings: ThemeAISettings;
    gameRules: ThemeGameRules;
}

// ==================== 战斗系统 ====================

export interface BulletState {
    loaded: boolean;
    cooldownEndTime: number | null;
    currentTarget: string | null;
}

export interface FishVoteInfo {
    count: number;
    voters: string[];
}

export interface GameResult {
    isVictory: boolean;
    mvpPlayerId?: string;
    mvpPlayerName?: string;
    aiRemaining: number;
    humanRemaining: number;
    humanKilled?: number;
    reason?: 'ai_majority' | 'too_many_human_killed';
}

// ==================== 淘汰动画 ====================

export interface EliminationData {
    fishId: string;
    fishName: string;
    isAI: boolean;
    fishOwnerId?: string;
    killerNames?: string[];
}

// ==================== WebSocket 事件数据 ====================

export interface VoteCastData {
    fishId: string;
    voterId: string;
}

export interface VoteRetractData {
    fishId: string;
    voterId: string;
}

export interface VoteChaseData {
    fishId: string;
    voterId: string;
}

export interface VoteUpdateData {
    fishId: string;
    count: number;
    voters: string[];
}

export interface VoteReceivedData {
    fishId: string;
    voterId: string;
}

export interface FishEliminateData {
    fishId: string;
    fishName: string;
    isAI: boolean;
    fishOwnerId: string;
    killerNames: string[];
}

export interface GameVictoryData {
    mvpId: string;
    mvpName: string;
    aiRemaining: number;
    humanRemaining: number;
}

export interface GameDefeatData {
    reason: string;
    humanKilled?: number;
    aiRemaining: number;
    humanRemaining: number;
}

// ==================== 后端响应格式 ====================

export interface BackendGameItem {
    id: string;
    imageUrl: string;
    name: string;
    description: string;
    author: string;
    isAI: boolean;
    createdAt: number;
    position?: Position;
    velocity?: Velocity;
    rotation?: number;
    scale?: number;
    flipX?: boolean;
    comments?: Comment[];
}

export interface SyncStateResponse {
    phase: string;
    roomId: string;
    totalItems: number;
    aiCount: number;
    turbidity: number;
    theme: ThemeConfig;
    items: BackendGameItem[];
}

// ==================== Toast 消息 ====================

export enum ToastType {
    SUCCESS = 'success',
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info',
    VOTE = 'vote',
    ELIMINATE = 'eliminate'
}

export interface ToastMessage {
    id: string;
    type: ToastType;
    content: string;
    duration?: number;
}

// ==================== 浮动伤害 ====================

export interface FloatingDamage {
    id: string;
    fishId: string;
    x: number;
    y: number;
    value: number;
    createdAt: number;
}
