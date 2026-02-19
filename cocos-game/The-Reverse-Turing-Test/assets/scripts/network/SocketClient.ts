import { _decorator, Component, sys, game } from 'cc';
// 使用本地 TypeScript 包装模块
import { io, Socket } from '../lib/socket-io';
import { GameManager } from '../core/GameManager';
import { DataConverter } from './DataConverter';
import {
    SyncStateResponse, FishEliminateData, ToastType
} from '../data/GameTypes';
import { ENV_CONFIG, NETWORK_CONFIG } from '../data/GameConstants';

const { ccclass } = _decorator;

/**
 * WebSocket 事件类型
 */
export type WSEventType =
    | 'room:join' | 'room:leave'
    | 'item:add' | 'item:remove' | 'item:update'
    | 'vote:cast' | 'vote:retract' | 'vote:chase' | 'vote:update' | 'vote:received'
    | 'fish:eliminate'
    | 'game:victory' | 'game:defeat'
    | 'sync:state'
    | 'comment:add';

/**
 * 微信小游戏 WebSocket 适配器
 * 将 wx.connectSocket 包装为标准 WebSocket 接口
 */
class WxWebSocketAdapter {
    private _wxSocket: any = null;
    private _readyState: number = WebSocket.CONNECTING;

    public onopen: ((event: any) => void) | null = null;
    public onmessage: ((event: { data: any }) => void) | null = null;
    public onclose: ((event: { code: number; reason: string }) => void) | null = null;
    public onerror: ((event: any) => void) | null = null;

    get readyState(): number {
        return this._readyState;
    }

    constructor(url: string, protocols?: string | string[]) {
        // @ts-ignore
        const wx = (globalThis as any).wx || (window as any).wx;
        if (!wx) {
            console.error('[WxWebSocketAdapter] WeChat API not available');
            this._readyState = WebSocket.CLOSED;
            return;
        }

        this._wxSocket = wx.connectSocket({
            url,
            protocols: Array.isArray(protocols) ? protocols : protocols ? [protocols] : undefined,
            success: () => {
                console.log('[WxWebSocketAdapter] Connecting...');
            },
            fail: (err: any) => {
                console.error('[WxWebSocketAdapter] Connect failed:', err);
                this._readyState = WebSocket.CLOSED;
                this.onerror?.({ message: err.errMsg });
            }
        });

        this._wxSocket.onOpen(() => {
            this._readyState = WebSocket.OPEN;
            this.onopen?.({});
        });

        this._wxSocket.onMessage((res: { data: any }) => {
            this.onmessage?.({ data: res.data });
        });

        this._wxSocket.onClose((res: { code: number; reason: string }) => {
            this._readyState = WebSocket.CLOSED;
            this.onclose?.({ code: res.code, reason: res.reason });
        });

        this._wxSocket.onError((err: any) => {
            this.onerror?.(err);
        });
    }

    send(data: string | ArrayBuffer): void {
        if (this._readyState !== WebSocket.OPEN) {
            console.warn('[WxWebSocketAdapter] Socket not open');
            return;
        }
        this._wxSocket?.send({
            data,
            fail: (err: any) => {
                console.error('[WxWebSocketAdapter] Send failed:', err);
            }
        });
    }

    close(code?: number, reason?: string): void {
        this._readyState = WebSocket.CLOSING;
        this._wxSocket?.close({
            code: code ?? 1000,
            reason: reason ?? '',
            success: () => {
                this._readyState = WebSocket.CLOSED;
            }
        });
    }
}

/**
 * 获取适合当前平台的 WebSocket 构造函数
 */
function getWebSocketImpl(): typeof WebSocket {
    if (sys.platform === sys.Platform.WECHAT_GAME) {
        return WxWebSocketAdapter as any;
    }
    return WebSocket;
}

/**
 * WebSocket 客户端封装
 * 统一使用 socket.io-client，微信小游戏通过适配器兼容
 */
@ccclass('SocketClient')
export class SocketClient extends Component {
    // ==================== 单例实现 ====================

    private static _instance: SocketClient = null!;

    public static get instance(): SocketClient {
        return SocketClient._instance;
    }

    // ==================== Socket 状态 ====================

    private _socket: Socket | null = null;
    private _roomId: string | null = null;
    private _isConnected: boolean = false;

    // ==================== 生命周期 ====================

    onLoad() {
        if (SocketClient._instance && SocketClient._instance !== this) {
            this.destroy();
            return;
        }
        SocketClient._instance = this;
        game.addPersistRootNode(this.node);
    }

    onDestroy() {
        this.disconnect();
        if (SocketClient._instance === this) {
            SocketClient._instance = null!;
        }
    }

    // ==================== 连接管理 ====================

    /**
     * 连接到服务器
     * @param roomId 房间ID
     */
    async connect(roomId: string): Promise<void> {
        if (this._socket) {
            this.disconnect();
        }

        this._roomId = roomId;
        GameManager.instance.setSynced(false);

        try {
            const socketUrl = ENV_CONFIG.WS_URL;
            console.log('[SocketClient] Connecting to:', socketUrl);

            // 微信小游戏使用适配器
            const WebSocketImpl = getWebSocketImpl();

            this._socket = io(socketUrl, {
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: NETWORK_CONFIG.RECONNECT_ATTEMPTS,
                reconnectionDelay: NETWORK_CONFIG.RECONNECT_DELAY,
                timeout: 10000,
                transports: ['websocket'],  // 仅使用 WebSocket
                // 注入自定义 WebSocket 实现
                ...(sys.platform === sys.Platform.WECHAT_GAME && {
                    webSocketCtor: WebSocketImpl
                })
            } as any);

            this._socket.on('connect', () => {
                console.log('[SocketClient] Connected, id:', this._socket?.id);
                this._isConnected = true;
                this._socket!.emit('room:join', { roomId: this._roomId });
            });

            this._socket.on('disconnect', (reason) => {
                console.log('[SocketClient] Disconnected:', reason);
                this._isConnected = false;
                if (reason === 'io server disconnect') {
                    this._socket!.connect();
                }
            });

            this._socket.on('connect_error', (error) => {
                console.error('[SocketClient] Connection error:', error.message);
                GameManager.instance.showToast(ToastType.ERROR, '连接服务器失败');
            });

            this._socket.io.on('reconnect', (attempt) => {
                console.log('[SocketClient] Reconnected after', attempt, 'attempts');
                GameManager.instance.showToast(ToastType.SUCCESS, '重新连接成功');
            });

            this._socket.io.on('reconnect_attempt', (attempt) => {
                GameManager.instance.showToast(ToastType.WARNING, `正在重连(${attempt})...`);
            });

            this._socket.io.on('reconnect_failed', () => {
                GameManager.instance.showToast(ToastType.ERROR, '无法连接到服务器');
            });

            // 注册业务事件监听
            this.registerEventListeners();

        } catch (error) {
            console.error('[SocketClient] Failed to connect:', error);
            GameManager.instance.showToast(ToastType.ERROR, '连接服务器失败');
        }
    }

    /**
     * 注册业务事件监听
     */
    private registerEventListeners(): void {
        if (!this._socket) return;

        this._socket.on('sync:state', (data: SyncStateResponse) => {
            this.handleSyncState(data);
        });

        this._socket.on('item:add', (data: any) => {
            GameManager.instance.addItem(DataConverter.convertBackendItem(data));
        });

        this._socket.on('item:remove', (data: { itemId: string }) => {
            GameManager.instance.removeItem(data.itemId);
        });

        this._socket.on('vote:update', (data: { fishId: string; count: number; voters: string[] }) => {
            GameManager.instance.updateFishVotes(data.fishId, data.count, data.voters);
        });

        this._socket.on('vote:received', (data: { fishId: string }) => {
            const gm = GameManager.instance;
            if (data.fishId === gm.playerFishId) {
                gm.setBeingAttacked();
                gm.showToast(ToastType.WARNING, '⚠️ 有人正在怀疑你');
            }
        });

        this._socket.on('fish:eliminate', (data: FishEliminateData) => {
            this.handleFishEliminate(data);
        });

        this._socket.on('game:victory', (data: any) => {
            GameManager.instance.setGameResult({
                isVictory: true,
                mvpPlayerId: data.mvpId,
                mvpPlayerName: data.mvpName,
                aiRemaining: data.aiRemaining,
                humanRemaining: data.humanRemaining
            });
        });

        this._socket.on('game:defeat', (data: any) => {
            GameManager.instance.setGameResult({
                isVictory: false,
                aiRemaining: data.aiRemaining,
                humanRemaining: data.humanRemaining,
                humanKilled: data.humanKilled,
                reason: data.reason as any
            });
        });

        this._socket.on('comment:add', (data: { itemId: string; comment: any }) => {
            const gm = GameManager.instance;
            const item = gm.getItem(data.itemId);
            if (item) {
                item.comments.push(data.comment);
                gm.updateItem(data.itemId, { comments: item.comments });
            }
        });
    }

    // ==================== 消息处理 ====================

    private handleSyncState(state: SyncStateResponse): void {
        console.log('[SocketClient] sync:state received');
        const gm = GameManager.instance;

        const items = DataConverter.convertItemList(state.items);
        const theme = DataConverter.convertTheme(state.theme);

        gm.syncState({
            phase: state.phase,
            roomId: state.roomId,
            aiCount: state.aiCount,
            turbidity: state.turbidity,
            theme: theme!,
            items
        });

        gm.setSynced(true);
    }

    private handleFishEliminate(data: FishEliminateData): void {
        const gm = GameManager.instance;

        gm.triggerElimination({
            fishId: data.fishId,
            fishName: data.fishName,
            isAI: data.isAI,
            fishOwnerId: data.fishOwnerId,
            killerNames: data.killerNames
        });

        const message = data.isAI
            ? `AI 间谍 "${data.fishName}" 被淘汰了！`
            : `"${data.fishName}" 被误杀了...`;
        const toastType = data.isAI ? ToastType.SUCCESS : ToastType.ERROR;
        gm.showToast(toastType, message);
    }

    // ==================== 发送消息 ====================

    /**
     * 发送事件
     */
    emit(event: WSEventType, data?: any): void {
        if (!this._socket || !this._isConnected) {
            console.warn('[SocketClient] Socket not connected');
            return;
        }
        this._socket.emit(event, data);
    }

    // ==================== 战斗系统操作 ====================

    castVote(fishId: string): void {
        const gm = GameManager.instance;
        if (!gm.playerId) {
            console.warn('[SocketClient] Player ID not set');
            return;
        }
        this.emit('vote:cast', { fishId, voterId: gm.playerId });
    }

    retractVote(fishId: string): void {
        const gm = GameManager.instance;
        if (!gm.playerId) return;
        this.emit('vote:retract', { fishId, voterId: gm.playerId });
    }

    chaseVote(fishId: string): void {
        const gm = GameManager.instance;
        if (!gm.playerId) return;
        this.emit('vote:chase', { fishId, voterId: gm.playerId });
    }

    addComment(itemId: string, author: string, content: string): void {
        this.emit('comment:add', { itemId, comment: { author, content } });
    }

    // ==================== 房间操作 ====================

    leaveRoom(): void {
        if (this._roomId) {
            this.emit('room:leave', { roomId: this._roomId });
        }
    }

    disconnect(): void {
        this.leaveRoom();

        if (this._socket) {
            this._socket.disconnect();
            this._socket = null;
        }

        this._isConnected = false;
        this._roomId = null;
    }

    // ==================== Getters ====================

    get isConnected(): boolean {
        return this._isConnected;
    }

    get roomId(): string | null {
        return this._roomId;
    }

    get socketId(): string | undefined {
        return this._socket?.id;
    }
}
