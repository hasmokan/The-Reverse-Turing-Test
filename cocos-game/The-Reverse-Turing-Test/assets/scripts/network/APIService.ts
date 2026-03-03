/**
 * REST API 服务
 * 迁移自: frontend/src/lib/api.ts
 *
 * 负责与后端 REST API 通信
 */

import { sys, warn as ccWarn, error as ccError } from 'cc';
import { ENV_CONFIG, NETWORK_CONFIG, ONLINE_FEATURES } from '../data/GameConstants';

// ==================== 响应类型 ====================

export interface RoomResponse {
    roomId: string;
    status: string;
    totalItems: number;
    aiCount: number;
    onlineCount: number;
    turbidity: number;
    votingStartedAt?: string;
    votingEndsAt?: string;
}

export interface RoomWithThemeResponse {
    room: RoomResponse;
    theme: ThemeResponse;
}

export interface ThemeRoomResponse {
    roomCode: string;
    theme: ThemeResponse;
}

export interface DrawingResponse {
    id: string;
    imageUrl: string;
    name: string;
    description?: string;
    author: string;
    position?: { x: number; y: number };
    velocity?: { vx: number; vy: number };
    rotation?: number;
    scale?: number;
    flipX?: boolean;
    voteCount?: number;
    isEliminated?: boolean;
    createdAt?: string;
}

export interface ThemeResponse {
    themeId: string;
    themeName: string;
    assets: {
        backgroundUrl: string;
        particleEffect?: string;
    };
    palette: string[];
    aiSettings: {
        keywords: string[];
        promptStyle: string;
    };
    gameRules: {
        spawnRate: number;
        maxImposters: number;
    };
}

export interface GuestLoginResponse {
    token: string;
    userId: string;
    isNewUser: boolean;
    isGuest: boolean;
    deviceToken: string;
}

// ==================== API 服务类 ====================

export class APIService {
    private static baseUrl: string = ENV_CONFIG.API_URL;
    private static authToken: string | null = null;
    private static userId: string | null = null;
    private static deviceToken: string | null = null;

    /**
     * 设置 API 基础 URL
     */
    static setBaseUrl(url: string): void {
        this.baseUrl = url;
    }

    static setAuthToken(token: string | null): void {
        this.authToken = token;
    }

    static getAuthToken(): string | null {
        return this.authToken;
    }

    static getCurrentUserId(): string | null {
        return this.userId;
    }

    // ==================== 通用请求方法 ====================

    /**
     * 发送 HTTP 请求
     */
    private static async request<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        body?: any,
        parseJson: boolean = true
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        const options: RequestInit = {
            method,
            headers
        };

        if (body !== undefined) {
            options.body = JSON.stringify(body);
        }

        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            NETWORK_CONFIG.REQUEST_TIMEOUT
        );
        options.signal = controller.signal;

        try {
            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!parseJson) {
                return await response.text() as unknown as T;
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            ccError(`[APIService] Request failed: ${method} ${path}`, error);
            throw error;
        }
    }

    /**
     * 微信小游戏 HTTP 请求
     */
    private static weChatRequest<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        body?: any
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const globalObj = globalThis as any;
            const wx = globalObj.wx || (typeof window !== 'undefined' ? (window as any).wx : null);
            if (!wx) {
                reject(new Error('WeChat API not available'));
                return;
            }

            const header: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (this.authToken) {
                header['Authorization'] = `Bearer ${this.authToken}`;
            }

            wx.request({
                url: `${this.baseUrl}${path}`,
                method,
                data: body,
                header,
                timeout: NETWORK_CONFIG.REQUEST_TIMEOUT,
                success: (res: any) => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(res.data);
                    } else {
                        reject(new Error(`HTTP error! status: ${res.statusCode}`));
                    }
                },
                fail: (err: any) => {
                    reject(err);
                }
            });
        });
    }

    /**
     * 跨平台请求
     */
    private static async fetch<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        body?: any,
        parseJson: boolean = true
    ): Promise<T> {
        if (!ONLINE_FEATURES.ENABLED) {
            throw new Error('[APIService] ONLINE_FEATURES.ENABLED=false，已禁用联网请求');
        }

        if (sys.platform === sys.Platform.WECHAT_GAME) {
            // 小游戏接口大多返回 JSON；当前仅健康检查需要文本兼容，这里在上层处理
            return this.weChatRequest(method, path, body);
        }
        return this.request(method, path, body, parseJson);
    }

    // ==================== 认证 API ====================

    static async ensureGuestAuth(sessionId?: string): Promise<GuestLoginResponse> {
        if (this.authToken && this.userId) {
            return {
                token: this.authToken,
                userId: this.userId,
                isNewUser: false,
                isGuest: true,
                deviceToken: this.deviceToken || ''
            };
        }

        const storedDeviceToken = this.getStoredDeviceToken();
        const payload: Record<string, string> = {
            device_token: storedDeviceToken,
        };

        if (sessionId) {
            payload.session_id = sessionId;
        }

        const resp = await this.fetch<GuestLoginResponse>('POST', '/api/auth/guest/login', payload);
        this.authToken = resp.token;
        this.userId = resp.userId;
        this.deviceToken = resp.deviceToken;
        this.storeDeviceToken(resp.deviceToken);

        return resp;
    }

    // ==================== 主题 API ====================

    /**
     * 获取所有主题列表
     */
    static async getThemes(): Promise<ThemeResponse[]> {
        return this.fetch<ThemeResponse[]>('GET', '/api/themes');
    }

    /**
     * 获取单个主题详情
     */
    static async getTheme(themeId: string): Promise<ThemeResponse> {
        return this.fetch<ThemeResponse>('GET', `/api/themes/${themeId}`);
    }

    // ==================== 房间 API ====================

    /**
     * 创建或获取房间
     * 如果该主题已有活跃房间，返回现有房间
     */
    static async getOrCreateRoom(themeId: string): Promise<ThemeRoomResponse> {
        return this.fetch<ThemeRoomResponse>('GET', `/api/themes/${themeId}/room`);
    }

    /**
     * 获取房间信息
     */
    static async getRoom(roomCode: string): Promise<RoomWithThemeResponse> {
        return this.fetch<RoomWithThemeResponse>('GET', `/api/rooms/${roomCode}`);
    }

    // ==================== 绘画 API ====================

    /**
     * 获取房间内的所有绘画
     */
    static async getDrawings(roomCode: string): Promise<DrawingResponse[]> {
        return this.fetch<DrawingResponse[]>('GET', `/api/rooms/${roomCode}/drawings`);
    }

    /**
     * 提交绘画
     */
    static async createDrawing(
        roomCode: string,
        data: {
            imageData: string;      // Base64 图片数据
            name: string;
            description?: string;
            sessionId: string;
            authorName?: string;
        }
    ): Promise<DrawingResponse> {
        return this.fetch<DrawingResponse>('POST', `/api/rooms/${roomCode}/drawings`, {
            image_data: data.imageData,
            name: data.name,
            description: data.description || '',
            session_id: data.sessionId,
            author_name: data.authorName || '匿名艺术家'
        });
    }

    /**
     * 举报绘画
     */
    static async reportDrawing(
        _roomCode: string,
        drawingId: string,
        sessionId: string,
        reason?: string
    ): Promise<void> {
        await this.fetch<void>('POST', `/api/drawings/${drawingId}/report`, {
            session_id: sessionId,
            reason: reason || ''
        });
    }

    // ==================== 健康检查 ====================

    /**
     * 检查服务器健康状态
     */
    static async healthCheck(): Promise<{ status: string }> {
        try {
            // 先尝试 JSON 解析
            return await this.fetch<{ status: string }>('GET', '/health');
        } catch (_err) {
            // 兼容后端返回纯文本 "OK"
            const text = await this.fetch<string>('GET', '/health', undefined, false);
            return { status: (text || '').trim().toLowerCase() || 'ok' };
        }
    }

    // ==================== AI 图片审核 ====================

    /**
     * 使用阶跃星辰 Vision API 审核图片
     * 迁移自: frontend/src/hooks/useImageReview.ts
     */
    static async reviewImage(
        imageBase64: string,
        keywords: string[]
    ): Promise<{
        isAppropriate: boolean;
        reason?: string;
    }> {
        const apiKey = ENV_CONFIG.VISION_API_KEY;

        // 如果没有配置 API Key，跳过审核
        if (!apiKey) {
            ccWarn('[APIService] Vision API key not configured, skipping review');
            return { isAppropriate: true };
        }

        const prompt = `你是一个儿童画内容审核员。请判断这幅画是否符合以下主题关键词: ${keywords.join(', ')}。
只需回答"通过"或"不通过"，如果不通过请简短说明原因。`;

        try {
            const response = await fetch(ENV_CONFIG.VISION_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: ENV_CONFIG.VISION_MODEL,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image_url',
                                    image_url: { url: imageBase64 }
                                }
                            ]
                        }
                    ],
                    max_tokens: 100
                })
            });

            if (!response.ok) {
                throw new Error(`Vision API error: ${response.status}`);
            }

            const result = await response.json();
            const content = result.choices?.[0]?.message?.content || '';

            const isAppropriate = content.includes('通过') && !content.includes('不通过');

            return {
                isAppropriate,
                reason: isAppropriate ? undefined : content
            };
        } catch (error) {
            ccError('[APIService] Image review failed:', error);
            // 审核失败时默认通过，避免阻塞用户
            return { isAppropriate: true };
        }
    }

    private static getStoredDeviceToken(): string {
        if (this.deviceToken) return this.deviceToken;

        const key = 'rtt_device_token';
        const existing = sys.localStorage?.getItem(key);
        if (existing) {
            this.deviceToken = existing;
            return existing;
        }

        const generated = `rtt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        this.deviceToken = generated;
        sys.localStorage?.setItem(key, generated);
        return generated;
    }

    private static storeDeviceToken(token: string): void {
        this.deviceToken = token;
        sys.localStorage?.setItem('rtt_device_token', token);
    }
}
