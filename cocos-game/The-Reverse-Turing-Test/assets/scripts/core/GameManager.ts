import { _decorator, Component, EventTarget, SpriteFrame, game } from 'cc';
import {
    GamePhase, GameItem, ThemeConfig, BulletState,
    FishVoteInfo, GameResult, EliminationData,
    ToastType, ToastMessage, FloatingDamage, Position, Velocity
} from '../data/GameTypes';
import { BATTLE_CONSTANTS, PHYSICS_CONFIG } from '../data/GameConstants';

const { ccclass, property } = _decorator;

/**
 * 游戏管理器 - 单例模式
 * 迁移自: frontend/src/lib/store.ts
 *
 * 负责管理:
 * - 游戏状态 (阶段、房间、物品)
 * - 战斗系统 (投票、CD、票数)
 * - 事件分发
 */
@ccclass('GameManager')
export class GameManager extends Component {
    // ==================== 单例实现 ====================

    private static _instance: GameManager = null!;

    public static get instance(): GameManager {
        return GameManager._instance;
    }

    // ==================== 事件系统 ====================

    public events: EventTarget = new EventTarget();

    // 事件名称常量
    public static readonly EVENT = {
        // 游戏状态事件
        PHASE_CHANGED: 'phase-changed',
        SYNCED: 'synced',
        GAME_RESULT: 'game-result',

        // 物品事件
        ITEM_ADDED: 'item-added',
        ITEM_REMOVED: 'item-removed',
        ITEM_UPDATED: 'item-updated',

        // 战斗事件
        VOTES_UPDATED: 'votes-updated',
        BULLET_STATE_CHANGED: 'bullet-state-changed',
        ELIMINATION_TRIGGERED: 'elimination-triggered',
        BEING_ATTACKED: 'being-attacked',

        // UI 事件
        SHOW_TOAST: 'show-toast',
        REMOVE_TOAST: 'remove-toast',
        FLOATING_DAMAGE: 'floating-damage',

        // 鱼点击事件
        FISH_CLICKED: 'fish-clicked'
    };

    // ==================== 游戏基础状态 ====================

    private _phase: GamePhase = GamePhase.LOBBY;
    private _roomId: string | null = null;
    private _theme: ThemeConfig | null = null;
    private _isSynced: boolean = false;

    // ==================== 物品 (鱼) 状态 ====================

    private _items: GameItem[] = [];
    private _totalItems: number = 0;
    private _aiCount: number = 0;
    private _turbidity: number = 0;

    // ==================== 战斗系统状态 ====================

    private _bullet: BulletState = {
        loaded: true,
        cooldownEndTime: null,
        currentTarget: null
    };

    private _fishVotes: Map<string, FishVoteInfo> = new Map();
    private _playerId: string | null = null;
    private _playerFishId: string | null = null;
    private _localFishSpriteFrames: Map<string, SpriteFrame> = new Map();

    // ==================== 游戏结果 ====================

    private _gameResult: GameResult | null = null;
    private _eliminationData: EliminationData | null = null;

    // ==================== Toast 消息队列 ====================

    private _toasts: ToastMessage[] = [];
    private _toastIdCounter: number = 0;

    // ==================== 可配置阈值 ====================

    private _eliminationThreshold: number = BATTLE_CONSTANTS.ELIMINATION_THRESHOLD;

    // ==================== 浮动伤害 ====================

    private _floatingDamages: FloatingDamage[] = [];
    private _damageIdCounter: number = 0;

    // ==================== 生命周期 ====================

    onLoad() {
        if (GameManager._instance && GameManager._instance !== this) {
            this.destroy();
            return;
        }
        GameManager._instance = this;

        // 保持跨场景不销毁
        game.addPersistRootNode(this.node);

        // 启动 CD 检查定时器
        this.schedule(this.checkCooldown, 0.1);
    }

    onDestroy() {
        if (GameManager._instance === this) {
            GameManager._instance = null!;
        }
        this.unschedule(this.checkCooldown);
    }

    // ==================== Getters ====================

    get phase(): GamePhase { return this._phase; }
    get roomId(): string | null { return this._roomId; }
    get theme(): ThemeConfig | null { return this._theme; }
    get isSynced(): boolean { return this._isSynced; }
    get items(): GameItem[] { return [...this._items]; }
    get totalItems(): number { return this._totalItems; }
    get aiCount(): number { return this._aiCount; }
    get turbidity(): number { return this._turbidity; }
    get bullet(): BulletState { return { ...this._bullet }; }
    get playerId(): string | null { return this._playerId; }
    get playerFishId(): string | null { return this._playerFishId; }
    get gameResult(): GameResult | null { return this._gameResult; }
    get eliminationData(): EliminationData | null { return this._eliminationData; }
    get toasts(): ToastMessage[] { return [...this._toasts]; }
    get eliminationThreshold(): number { return this._eliminationThreshold; }

    // ==================== 基础状态操作 ====================

    setEliminationThreshold(threshold: number): void {
        this._eliminationThreshold = threshold;
    }

    setPhase(phase: GamePhase): void {
        if (this._phase !== phase) {
            const oldPhase = this._phase;
            this._phase = phase;
            this.events.emit(GameManager.EVENT.PHASE_CHANGED, phase, oldPhase);
        }
    }

    setRoomId(roomId: string): void {
        this._roomId = roomId;
    }

    setTheme(theme: ThemeConfig): void {
        this._theme = theme;
    }

    setSynced(synced: boolean): void {
        this._isSynced = synced;
        if (synced) {
            this.events.emit(GameManager.EVENT.SYNCED);
        }
    }

    // ==================== 物品 (鱼) 管理 ====================

    addItem(itemData: Partial<GameItem>): void {
        // 去重检查
        if (itemData.id && this._items.some(i => i.id === itemData.id)) {
            return;
        }

        const direction = Math.random() > 0.5 ? 1 : -1;
        const bounds = PHYSICS_CONFIG.BOUNDS;
        const velocity = PHYSICS_CONFIG.VELOCITY;
        const scale = PHYSICS_CONFIG.SCALE;
        const rotation = PHYSICS_CONFIG.ROTATION;

        const newItem: GameItem = {
            id: itemData.id || this.generateId(),
            imageUrl: itemData.imageUrl || '',
            name: itemData.name || '',
            description: itemData.description || '',
            author: itemData.author || '匿名艺术家',
            isAI: itemData.isAI || false,
            createdAt: itemData.createdAt || Date.now(),
            position: itemData.position || {
                x: this.randomRange(bounds.MIN_X, bounds.MAX_X),
                y: this.randomRange(bounds.MIN_Y, bounds.MAX_Y)
            },
            velocity: itemData.velocity || {
                vx: direction * this.randomRange(velocity.MIN_VX, velocity.MAX_VX),
                vy: this.randomRange(velocity.MIN_VY, velocity.MAX_VY)
            },
            rotation: itemData.rotation ?? this.randomRange(rotation.MIN, rotation.MAX),
            scale: itemData.scale ?? this.randomRange(scale.MIN, scale.MAX),
            flipX: itemData.flipX ?? (direction < 0),
            comments: itemData.comments || []
        };

        this._items.push(newItem);
        this._totalItems = this._items.length;

        if (newItem.isAI) {
            this._aiCount++;
            this.updateTurbidity();
        }

        this.events.emit(GameManager.EVENT.ITEM_ADDED, newItem);
    }

    removeItem(itemId: string): void {
        const index = this._items.findIndex(i => i.id === itemId);
        if (index !== -1) {
            const item = this._items[index];
            this._items.splice(index, 1);
            this._totalItems = this._items.length;

            if (item.isAI) {
                this._aiCount = Math.max(0, this._aiCount - 1);
                this.updateTurbidity();
            }

            // 清除该鱼的票数
            this._fishVotes.delete(itemId);
            this.clearLocalFishSpriteFrame(itemId);

            this.events.emit(GameManager.EVENT.ITEM_REMOVED, itemId);
        }
    }

    updateItem(itemId: string, updates: Partial<GameItem>): void {
        const item = this._items.find(i => i.id === itemId);
        if (item) {
            Object.assign(item, updates);
            this.events.emit(GameManager.EVENT.ITEM_UPDATED, itemId, updates);
        }
    }

    getItem(itemId: string): GameItem | undefined {
        return this._items.find(i => i.id === itemId);
    }

    // ==================== 玩家标识 ====================

    setPlayerId(playerId: string): void {
        this._playerId = playerId;
    }

    setPlayerFishId(fishId: string): void {
        this._playerFishId = fishId;
    }

    setLocalFishSpriteFrame(fishId: string, spriteFrame: SpriteFrame): void {
        this._localFishSpriteFrames.set(fishId, spriteFrame);
    }

    getLocalFishSpriteFrame(fishId: string): SpriteFrame | null {
        return this._localFishSpriteFrames.get(fishId) || null;
    }

    private clearLocalFishSpriteFrame(itemId: string): void {
        const spriteFrame = this._localFishSpriteFrames.get(itemId);
        if (spriteFrame && spriteFrame.isValid) {
            spriteFrame.destroy();
        }
        this._localFishSpriteFrames.delete(itemId);
    }

    // ==================== 战斗系统 - 子弹/投票 ====================

    fireBullet(targetId: string): boolean {
        if (!this._bullet.loaded) {
            return false;
        }

        this._bullet = {
            loaded: false,
            cooldownEndTime: Date.now() + BATTLE_CONSTANTS.COOLDOWN_DURATION,
            currentTarget: targetId
        };

        this.events.emit(GameManager.EVENT.BULLET_STATE_CHANGED, this._bullet);
        return true;
    }

    reloadBullet(): void {
        this._bullet.loaded = true;
        this._bullet.cooldownEndTime = null;
        this.events.emit(GameManager.EVENT.BULLET_STATE_CHANGED, this._bullet);
    }

    changeTarget(newTargetId: string): string | null {
        const oldTarget = this._bullet.currentTarget;
        this._bullet.currentTarget = newTargetId;
        this.events.emit(GameManager.EVENT.BULLET_STATE_CHANGED, this._bullet);
        return oldTarget;
    }

    chaseFire(targetId: string): void {
        // 追击: 重置 CD 但不改变票数
        this._bullet.cooldownEndTime = Date.now() + BATTLE_CONSTANTS.COOLDOWN_DURATION;
        this.events.emit(GameManager.EVENT.BULLET_STATE_CHANGED, this._bullet);
    }

    private checkCooldown(): void {
        if (this._bullet.cooldownEndTime && Date.now() >= this._bullet.cooldownEndTime) {
            this.reloadBullet();
        }
    }

    getCooldownProgress(): number {
        if (!this._bullet.cooldownEndTime) return 1;
        const remaining = this._bullet.cooldownEndTime - Date.now();
        if (remaining <= 0) return 1;
        return 1 - (remaining / BATTLE_CONSTANTS.COOLDOWN_DURATION);
    }

    // ==================== 战斗系统 - 票数管理 ====================

    updateFishVotes(fishId: string, count: number, voters: string[]): void {
        this._fishVotes.set(fishId, { count, voters });
        this.events.emit(GameManager.EVENT.VOTES_UPDATED, fishId, count, voters);

        // 检查是否达到淘汰阈值
        if (count >= this._eliminationThreshold) {
            const item = this.getItem(fishId);
            if (item) {
                this.triggerElimination({
                    fishId,
                    fishName: item.name,
                    isAI: item.isAI
                });
            }
        }
    }

    getVoteCount(fishId: string): number {
        return this._fishVotes.get(fishId)?.count || 0;
    }

    getVoters(fishId: string): string[] {
        return this._fishVotes.get(fishId)?.voters || [];
    }

    clearFishVotes(fishId: string): void {
        this._fishVotes.delete(fishId);
    }

    // ==================== 淘汰动画 ====================

    triggerElimination(data: EliminationData): void {
        this._eliminationData = data;
        this.events.emit(GameManager.EVENT.ELIMINATION_TRIGGERED, data);
    }

    clearEliminationAnimation(): void {
        this._eliminationData = null;
    }

    // ==================== 游戏结果 ====================

    setGameResult(result: GameResult): void {
        this._gameResult = result;
        this._phase = GamePhase.GAMEOVER;
        this.events.emit(GameManager.EVENT.GAME_RESULT, result);
    }

    clearGameResult(): void {
        this._gameResult = null;
    }

    // ==================== 攻击警告 ====================

    setBeingAttacked(duration: number = 5000): void {
        this.events.emit(GameManager.EVENT.BEING_ATTACKED, duration);
    }

    // ==================== Toast 消息 ====================

    showToast(type: ToastType, content: string, duration: number = 2000): string {
        const id = `toast_${++this._toastIdCounter}`;
        const toast: ToastMessage = { id, type, content, duration };
        this._toasts.push(toast);

        // 限制最大数量
        if (this._toasts.length > 5) {
            this._toasts.shift();
        }

        this.events.emit(GameManager.EVENT.SHOW_TOAST, toast);

        // 自动移除
        this.scheduleOnce(() => {
            this.removeToast(id);
        }, duration / 1000);

        return id;
    }

    removeToast(id: string): void {
        const index = this._toasts.findIndex(t => t.id === id);
        if (index !== -1) {
            this._toasts.splice(index, 1);
            this.events.emit(GameManager.EVENT.REMOVE_TOAST, id);
        }
    }

    // ==================== 浮动伤害 ====================

    addFloatingDamage(fishId: string, x: number, y: number, value: number = 1): string {
        const id = `damage_${++this._damageIdCounter}`;
        const damage: FloatingDamage = {
            id,
            fishId,
            x,
            y,
            value,
            createdAt: Date.now()
        };
        this._floatingDamages.push(damage);

        // 限制最大数量
        if (this._floatingDamages.length > 20) {
            this._floatingDamages.shift();
        }

        this.events.emit(GameManager.EVENT.FLOATING_DAMAGE, damage);

        // 自动移除
        this.scheduleOnce(() => {
            this.removeFloatingDamage(id);
        }, 1);

        return id;
    }

    removeFloatingDamage(id: string): void {
        const index = this._floatingDamages.findIndex(d => d.id === id);
        if (index !== -1) {
            this._floatingDamages.splice(index, 1);
        }
    }

    // ==================== 状态同步 ====================

    syncState(state: {
        phase?: string;
        roomId?: string;
        totalItems?: number;
        aiCount?: number;
        turbidity?: number;
        theme?: ThemeConfig;
        items?: GameItem[];
    }): void {
        if (state.roomId) this._roomId = state.roomId;
        if (state.theme) this._theme = state.theme;
        if (state.aiCount !== undefined) this._aiCount = state.aiCount;
        if (state.turbidity !== undefined) this._turbidity = state.turbidity;

        if (state.phase) {
            const mappedPhase = this.mapPhase(state.phase);
            this.setPhase(mappedPhase);
        }

        if (state.items) {
            // 使用 Map 合并，避免重复
            const itemMap = new Map<string, GameItem>();

            // 先添加后端的 items
            state.items.forEach(item => itemMap.set(item.id, item));

            // 再添加本地的 items (保留本地最新位置等)
            this._items.forEach(item => {
                if (!itemMap.has(item.id)) {
                    itemMap.set(item.id, item);
                }
            });

            this._items = Array.from(itemMap.values());
            this._totalItems = this._items.length;
        }
    }

    private mapPhase(phase: string): GamePhase {
        const mapping: Record<string, GamePhase> = {
            'lobby': GamePhase.LOBBY,
            'drawing': GamePhase.DRAWING,
            'viewing': GamePhase.VIEWING,
            'active': GamePhase.VIEWING,  // 后端 'active' 映射为 'viewing'
            'voting': GamePhase.VOTING,
            'result': GamePhase.RESULT,
            'gameover': GamePhase.GAMEOVER
        };
        return mapping[phase] || GamePhase.VIEWING;
    }

    // ==================== 重置游戏 ====================

    resetGame(): void {
        this._phase = GamePhase.LOBBY;
        this._roomId = null;
        this._theme = null;
        this._isSynced = false;
        this._items = [];
        this._totalItems = 0;
        this._aiCount = 0;
        this._turbidity = 0;
        this._bullet = { loaded: true, cooldownEndTime: null, currentTarget: null };
        this._fishVotes.clear();
        this._gameResult = null;
        this._eliminationData = null;
        this._toasts = [];
        this._floatingDamages = [];
        this._eliminationThreshold = BATTLE_CONSTANTS.ELIMINATION_THRESHOLD;
        this._localFishSpriteFrames.forEach((spriteFrame) => {
            if (spriteFrame && spriteFrame.isValid) {
                spriteFrame.destroy();
            }
        });
        this._localFishSpriteFrames.clear();
    }

    // ==================== 工具方法 ====================

    private updateTurbidity(): void {
        this._turbidity = Math.min(1, this._aiCount / BATTLE_CONSTANTS.DEFEAT_MAX_AI_COUNT);
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private randomRange(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }
}
