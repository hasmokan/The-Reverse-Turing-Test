import {
    _decorator, Component, Node, Prefab, instantiate,
    Vec3, UITransform, tween, Sprite, Color,
    warn as ccWarn,
} from 'cc';
import { GameManager } from '../core/GameManager';
import { FishController } from './FishController';
import { GameItem, EliminationData, ToastType } from '../data/GameTypes';
import { BUBBLE_CONFIG, PHYSICS_CONFIG } from '../data/GameConstants';
import { PresetFishSwimSpawner } from './PresetFishSwimSpawner';

const { ccclass, property } = _decorator;

/**
 * 游戏舞台控制器
 * 迁移自: frontend/src/components/stage/GameStage.tsx
 *
 * 负责:
 * - 管理所有鱼的节点
 * - 气泡粒子效果
 * - 浑浊度效果
 */
@ccclass('GameStage')
export class GameStage extends Component {
    @property(Prefab)
    fishPrefab: Prefab = null!;

    @property(Prefab)
    bubblePrefab: Prefab = null!;

    @property(Node)
    fishContainer: Node = null!;

    @property(Node)
    bubbleContainer: Node = null!;

    @property(Node)
    fishSwimContainer: Node = null!;

    @property(Sprite)
    turbidityMask: Sprite = null!;  // 浑浊度遮罩

    // 鱼节点映射
    private _fishNodes: Map<string, Node> = new Map();

    start() {
        this.initBubbles();
        this.ensurePresetFishSwimmer();
        this.bindEvents();
        this.initExistingItems();
    }

    private ensurePresetFishSwimmer(): void {
        const sceneRoot = this.node.scene;
        if (sceneRoot && this.hasActivePresetSpawner(sceneRoot)) {
            return;
        }

        let spawner = this.node.getComponent(PresetFishSwimSpawner);
        if (!spawner) {
            spawner = this.node.addComponent(PresetFishSwimSpawner);
        }

        if (this.fishSwimContainer && this.fishSwimContainer.isValid && this.fishSwimContainer.activeInHierarchy) {
            spawner.fishSwimContainer = this.fishSwimContainer;
        } else if (this.fishContainer && this.fishContainer.isValid && this.fishContainer.activeInHierarchy) {
            // Keep compatibility for old scenes where fish swim container was not exposed.
            spawner.fishSwimContainer = this.fishContainer;
        }
    }

    private hasActivePresetSpawner(root: Node): boolean {
        if (root !== this.node && root.getComponent(PresetFishSwimSpawner) && root.activeInHierarchy) {
            return true;
        }

        for (const child of root.children) {
            if (this.hasActivePresetSpawner(child)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 初始化气泡粒子
     */
    private initBubbles(): void {
        if (!this.bubblePrefab || !this.bubbleContainer) return;

        for (let i = 0; i < BUBBLE_CONFIG.COUNT; i++) {
            this.createBubble(i);
        }
    }

    /**
     * 创建单个气泡
     */
    private createBubble(index: number): void {
        const bubble = instantiate(this.bubblePrefab);
        this.bubbleContainer.addChild(bubble);

        const startX = this.seededRange(index, 0, 400);
        const scale = this.seededRange(index + 100, BUBBLE_CONFIG.SCALE.MIN, BUBBLE_CONFIG.SCALE.MAX);
        const duration = this.seededRange(index + 200, BUBBLE_CONFIG.DURATION.MIN, BUBBLE_CONFIG.DURATION.MAX);
        const delay = this.seededRange(index + 300, BUBBLE_CONFIG.DELAY.MIN, BUBBLE_CONFIG.DELAY.MAX);

        bubble.setPosition(startX, -50, 0);
        bubble.setScale(scale, scale, 1);

        // 延迟启动气泡动画
        this.scheduleOnce(() => {
            this.animateBubble(bubble, startX, duration);
        }, delay);
    }

    /**
     * 气泡上浮动画
     */
    private animateBubble(bubble: Node, startX: number, duration: number): void {
        if (!bubble.isValid) return;

        const driftX = BUBBLE_CONFIG.DRIFT_X;

        tween(bubble)
            .to(duration, {
                position: new Vec3(startX + driftX * (Math.random() - 0.5), 600, 0)
            })
            .call(() => {
                // 重置到底部，继续循环
                bubble.setPosition(startX, -50, 0);
                this.animateBubble(bubble, startX, duration);
            })
            .start();
    }

    /**
     * 绑定事件
     */
    private bindEvents(): void {
        const gm = GameManager.instance;

        gm.events.on(GameManager.EVENT.ITEM_ADDED, this.onItemAdded, this);
        gm.events.on(GameManager.EVENT.ITEM_REMOVED, this.onItemRemoved, this);
        gm.events.on(GameManager.EVENT.ITEM_UPDATED, this.onItemUpdated, this);
        gm.events.on(GameManager.EVENT.VOTES_UPDATED, this.onVotesUpdated, this);
        gm.events.on(GameManager.EVENT.ELIMINATION_TRIGGERED, this.onEliminationTriggered, this);
    }

    /**
     * 初始化已有的鱼
     */
    private initExistingItems(): void {
        const items = GameManager.instance.items;
        items.forEach(item => this.createFishNode(item));
    }

    /**
     * 物品添加事件
     */
    private onItemAdded(item: GameItem): void {
        this.createFishNode(item);
    }

    /**
     * 物品移除事件
     */
    private onItemRemoved(itemId: string): void {
        const node = this._fishNodes.get(itemId);
        if (node) {
            node.destroy();
            this._fishNodes.delete(itemId);
        }
    }

    /**
     * 物品更新事件
     */
    private onItemUpdated(itemId: string, updates: Partial<GameItem>): void {
        const node = this._fishNodes.get(itemId);
        if (node) {
            const controller = node.getComponent(FishController);
            controller?.applyUpdates(updates);
        }
    }

    /**
     * 票数更新事件
     */
    private onVotesUpdated(fishId: string, count: number, voters: string[]): void {
        const node = this._fishNodes.get(fishId);
        if (node) {
            const controller = node.getComponent(FishController);
            controller?.updateVoteDisplay(count);
            controller?.playHitEffect();
        }
    }

    /**
     * 淘汰事件
     */
    private onEliminationTriggered(data: EliminationData): void {
        const node = this._fishNodes.get(data.fishId);
        if (node) {
            const controller = node.getComponent(FishController);
            controller?.playEliminateAnimation(() => {
                this._fishNodes.delete(data.fishId);
            });
        }

        // 更新浑浊度
        this.updateTurbidity();
    }

    /**
     * 创建鱼节点
     */
    private createFishNode(item: GameItem): void {
        if (!this.fishContainer) {
            ccWarn('[GameStage] fishContainer not set');
            return;
        }

        // 检查是否已存在
        if (this._fishNodes.has(item.id)) {
            return;
        }

        let fishNode: Node;
        if (!this.fishPrefab) {
            ccWarn('[GameStage] fishPrefab not set, using fallback fish node');
            fishNode = this.createFallbackFishNode(item);
        } else {
            fishNode = instantiate(this.fishPrefab);
            this.fishContainer.addChild(fishNode);
        }

        // 初始化控制器
        const controller = fishNode.getComponent(FishController);
        if (controller) {
            const sprite = fishNode.getComponent(Sprite);
            if (!controller.fishSprite && sprite) {
                controller.fishSprite = sprite;
            }
            controller.init(item);
        } else {
            ccWarn(`[GameStage] FishController missing on fish node: ${fishNode.name}`);
        }

        this._fishNodes.set(item.id, fishNode);
    }

    /**
     * 当场景未配置 fishPrefab 时，动态创建可游动鱼节点，保证投放可见。
     */
    private createFallbackFishNode(item: GameItem): Node {
        const fishNode = new Node(`Fish_${item.id}`);
        this.fishContainer.addChild(fishNode);

        const transform = fishNode.getComponent(UITransform) || fishNode.addComponent(UITransform);
        transform.setContentSize(120, 72);

        const sprite = fishNode.getComponent(Sprite) || fishNode.addComponent(Sprite);
        sprite.color = new Color(255, 255, 255, 255);

        const controller = fishNode.getComponent(FishController) || fishNode.addComponent(FishController);
        controller.fishSprite = sprite;

        return fishNode;
    }

    /**
     * 更新浑浊度效果
     */
    updateTurbidity(): void {
        const turbidity = GameManager.instance.turbidity;

        if (this.turbidityMask) {
            // 根据浑浊度设置遮罩透明度
            const opacity = Math.floor(turbidity * 0.4 * 255);
            const color = this.turbidityMask.color.clone();
            color.a = opacity;
            this.turbidityMask.color = color;
        }
    }

    /**
     * 获取鱼节点
     */
    getFishNode(fishId: string): Node | undefined {
        return this._fishNodes.get(fishId);
    }

    /**
     * 获取所有鱼节点
     */
    getAllFishNodes(): Map<string, Node> {
        return this._fishNodes;
    }

    // ==================== 工具方法 ====================

    /**
     * 基于种子的伪随机数生成
     */
    private seededRange(seed: number, min: number, max: number): number {
        const x = Math.sin(seed * 9999) * 10000;
        const rand = x - Math.floor(x);
        return min + rand * (max - min);
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.ITEM_ADDED, this.onItemAdded, this);
            gm.events.off(GameManager.EVENT.ITEM_REMOVED, this.onItemRemoved, this);
            gm.events.off(GameManager.EVENT.ITEM_UPDATED, this.onItemUpdated, this);
            gm.events.off(GameManager.EVENT.VOTES_UPDATED, this.onVotesUpdated, this);
            gm.events.off(GameManager.EVENT.ELIMINATION_TRIGGERED, this.onEliminationTriggered, this);
        }
    }
}
