/**
 * 后端 API 服务层
 * 对接 Rust 后端 REST API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ============ 类型定义 ============

// 主题响应
export interface ThemeResponse {
  themeId: string
  themeName: string
  backgroundUrl: string
  particleEffect?: string
  palette: string[]
  aiKeywords: string[]
  aiPromptStyle: string
  spawnRate: number
  maxImposters: number
}

// 房间响应
export interface RoomResponse {
  roomId: string
  status: string
  totalItems: number
  aiCount: number
  onlineCount: number
  turbidity: number
  votingStartedAt?: string
  votingEndsAt?: string
}

// 房间详情（含主题）
export interface RoomWithTheme {
  room: RoomResponse
  theme: ThemeResponse
}

// 绘画列表项
export interface DrawingListItem {
  id: string
  name: string
  description?: string
  author: string
  position: { x: number; y: number }
  velocity: { vx: number; vy: number }
  rotation: number
  scale: number
  flipX: boolean
  voteCount: number
  isEliminated: boolean
  createdAt: string
}

// 绘画详情
export interface DrawingResponse extends DrawingListItem {
  imageUrl: string
}

// 创建绘画请求
export interface CreateDrawingRequest {
  image_data: string
  name: string
  description?: string
  session_id: string
  author_name?: string
}

// 投票响应
export interface VoteResponse {
  vote_count: number
  threshold: number
  eliminated: boolean
}

// 举报响应
export interface ReportResponse {
  report_count: number
  hidden: boolean
}

// ============ API 函数 ============

/**
 * 通用请求函数
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  return response.json()
}

// ============ 主题 API ============

/**
 * 获取所有主题
 */
export async function getThemes(): Promise<ThemeResponse[]> {
  return request<ThemeResponse[]>('/api/themes')
}

/**
 * 获取单个主题
 */
export async function getTheme(themeId: string): Promise<ThemeResponse> {
  return request<ThemeResponse>(`/api/themes/${themeId}`)
}

// ============ 房间 API ============

// 获取或创建房间的响应类型
export interface ThemeRoomResponse {
  roomCode: string
  theme: ThemeResponse
}

/**
 * 获取或创建房间（先查询该主题的活跃房间，没有则创建）
 */
export async function getOrCreateRoom(themeId: string): Promise<ThemeRoomResponse> {
  return request<ThemeRoomResponse>(`/api/themes/${themeId}/room`)
}

/**
 * 创建房间（直接创建新房间）
 */
export async function createRoom(themeId: string): Promise<RoomWithTheme> {
  return request<RoomWithTheme>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ theme_id: themeId }),
  })
}

/**
 * 获取房间信息
 */
export async function getRoom(roomCode: string): Promise<RoomWithTheme> {
  return request<RoomWithTheme>(`/api/rooms/${roomCode}`)
}

/**
 * 获取房间内所有绘画
 */
export async function getRoomDrawings(roomCode: string): Promise<DrawingListItem[]> {
  return request<DrawingListItem[]>(`/api/rooms/${roomCode}/drawings`)
}

// ============ 绘画 API ============

/**
 * 提交绘画
 */
export async function createDrawing(
  roomCode: string,
  data: CreateDrawingRequest
): Promise<DrawingResponse> {
  return request<DrawingResponse>(`/api/rooms/${roomCode}/drawings`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * 获取绘画详情
 */
export async function getDrawing(drawingId: string): Promise<DrawingResponse> {
  return request<DrawingResponse>(`/api/drawings/${drawingId}`)
}

/**
 * 投票
 */
export async function voteDrawing(
  drawingId: string,
  sessionId: string
): Promise<VoteResponse> {
  return request<VoteResponse>(`/api/drawings/${drawingId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  })
}

/**
 * 举报
 */
export async function reportDrawing(
  drawingId: string,
  sessionId: string,
  reason?: string
): Promise<ReportResponse> {
  return request<ReportResponse>(`/api/drawings/${drawingId}/report`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, reason }),
  })
}

// ============ 健康检查 ============

/**
 * 健康检查
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`)
    return response.ok
  } catch {
    return false
  }
}

// ============ 工具函数 ============

/**
 * 生成会话 ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 从 localStorage 获取或创建会话 ID
 */
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return generateSessionId()

  let sessionId = localStorage.getItem('mimic_session_id')
  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem('mimic_session_id', sessionId)
  }
  return sessionId
}

/**
 * 转换后端主题格式为前端格式
 */
export function convertThemeResponse(theme: ThemeResponse) {
  return {
    theme_id: theme.themeId,
    theme_name: theme.themeName,
    assets: {
      background_url: theme.backgroundUrl,
      particle_effect: theme.particleEffect,
    },
    palette: theme.palette,
    ai_settings: {
      keywords: theme.aiKeywords,
      prompt_style: theme.aiPromptStyle,
    },
    game_rules: {
      spawn_rate: theme.spawnRate,
      max_imposters: theme.maxImposters,
    },
  }
}
