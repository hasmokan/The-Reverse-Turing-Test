import { _decorator, Component, Node, Label, Prefab, instantiate,
         tween, Vec3, UIOpacity, Color, Pool } from 'cc';
import { GameManager } from '../../core/GameManager';
import { FloatingDamage } from '../../data/GameTypes';
import { UI_CONFIG, ANIMATION_DURATION } from '../../data/GameConstants';

const { ccclass, property } = _decorator;

/**
 * 浮动伤害管理器
 * 管理攻击时在鱼身上飘起的伤害数字
 *
 * 功能：
 * - 显示伤害数字（+1）
 * - 上浮 + 淡出动画
 * - 对象池优化性能
 * - 支持不同颜色（普通/暴击/治疗）
 */
@ccclass('FloatingDamageManager')
export class FloatingDamageManager extends Component {
    // ==================== 配置 ====================

    @property(Prefab)
    damagePrefab: Prefab = null!;          // 伤害数字 Prefab

    @property(Node)
    container: Node = null!;               // 容器节点

    @property
    floatHeight: number = 80;              // 上浮高度

    @property
    floatDuration: number = 0.8;           // 动画时长

    @property
    randomOffsetX: number = 20;            // X 轴随机偏移

    // ==================== 颜色配置 ====================

    private readonly COLOR_NORMAL = new Color(255, 255, 255, 255);   // 白色 - 普通伤害
    private readonly COLOR_CRITICAL = new Color(255, 215, 0, 255);   // 金色 - 暴击
    private readonly COLOR_HEAL = new Color(76, 175, 80, 255);       // 绿色 - 治疗
    private readonly COLOR_MISS = new Color(158, 158, 158, 255);     // 灰色 - 未命中

    // ==================== 对象池 ====================

    private _pool: Node[] = [];
    private _activeNodes: Map<string, Node> = new Map();

    // ==================== 生命周期 ====================

    start() {
        this.bindEvents();
        this.initPool();
    }

    /**
     * 绑定事件
     */
    private bindEvents(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.on(GameManager.EVENT.FLOATING_DAMAGE, this.onFloatingDamage, this);
        }
    }

    /**
     * 初始化对象池
     */
    private initPool(): void {
        if (!this.damagePrefab) return;

        // 预创建一些节点
        const preloadCount = 10;
        for (let i = 0; i < preloadCount; i++) {
            const node = this.createDamageNode();
            node.active = false;
            this._pool.push(node);
        }
    }

    /**
     * 创建伤害节点
     */
    private createDamageNode(): Node {
        if (this.damagePrefab) {
            const node = instantiate(this.damagePrefab);
            if (this.container) {
                this.container.addChild(node);
            }
            return node;
        }

        // 如果没有 Prefab，创建简单的 Label 节点
        const node = new Node('FloatingDamage');
        const label = node.addComponent(Label);
        label.fontSize = 32;
        label.isBold = true;
        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 200);
        label.outlineWidth = 3;

        if (this.container) {
            this.container.addChild(node);
        }

        return node;
    }

    // ==================== 事件处理 ====================

    /**
     * 浮动伤害事件
     */
    private onFloatingDamage(damage: FloatingDamage): void {
        this.showDamage(damage.id, damage.x, damage.y, damage.value);
    }

    // ==================== 公共方法 ====================

    /**
     * 显示伤害数字
     * @param id 唯一标识
     * @param x X 坐标
     * @param y Y 坐标
     * @param value 伤害值
     * @param type 类型：normal/critical/heal/miss
     */
    showDamage(
        id: string,
        x: number,
        y: number,
        value: number,
        type: 'normal' | 'critical' | 'heal' | 'miss' = 'normal'
    ): void {
        // 限制最大数量
        if (this._activeNodes.size >= UI_CONFIG.MAX_FLOATING_DAMAGE) {
            // 移除最早的
            const firstId = this._activeNodes.keys().next().value;
            if (firstId) {
                this.removeDamage(firstId);
            }
        }

        // 获取节点
        const node = this.getNode();
        if (!node) return;

        // 设置位置（添加随机偏移）
        const offsetX = (Math.random() - 0.5) * this.randomOffsetX * 2;
        node.setPosition(x + offsetX, y, 0);

        // 设置文字和颜色
        const label = node.getComponent(Label);
        if (label) {
            // 格式化文字
            let text = '';
            let color = this.COLOR_NORMAL;

            switch (type) {
                case 'critical':
                    text = `💥 ${value}`;
                    color = this.COLOR_CRITICAL;
                    break;
                case 'heal':
                    text = `+${value}`;
                    color = this.COLOR_HEAL;
                    break;
                case 'miss':
                    text = 'MISS';
                    color = this.COLOR_MISS;
                    break;
                default:
                    text = `-${value}`;
                    color = this.COLOR_NORMAL;
            }

            label.string = text;
            label.color = color;

            // 暴击时字体更大
            if (type === 'critical') {
                label.fontSize = 40;
            } else {
                label.fontSize = 32;
            }
        }

        // 显示节点
        node.active = true;
        node.setScale(0.5, 0.5, 1);

        // 添加透明度组件
        let opacity = node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = node.addComponent(UIOpacity);
        }
        opacity.opacity = 255;

        // 记录活跃节点
        this._activeNodes.set(id, node);

        // 播放动画
        this.playAnimation(id, node, type);
    }

    /**
     * 快捷方法：显示普通伤害
     */
    showNormalDamage(x: number, y: number, value: number = 1): void {
        const id = `damage_${Date.now()}_${Math.random()}`;
        this.showDamage(id, x, y, value, 'normal');
    }

    /**
     * 快捷方法：显示暴击伤害
     */
    showCriticalDamage(x: number, y: number, value: number): void {
        const id = `damage_${Date.now()}_${Math.random()}`;
        this.showDamage(id, x, y, value, 'critical');
    }

    /**
     * 快捷方法：显示治疗
     */
    showHeal(x: number, y: number, value: number): void {
        const id = `damage_${Date.now()}_${Math.random()}`;
        this.showDamage(id, x, y, value, 'heal');
    }

    /**
     * 快捷方法：显示未命中
     */
    showMiss(x: number, y: number): void {
        const id = `damage_${Date.now()}_${Math.random()}`;
        this.showDamage(id, x, y, 0, 'miss');
    }

    // ==================== 私有方法 ====================

    /**
     * 从对象池获取节点
     */
    private getNode(): Node | null {
        // 尝试从池中获取
        if (this._pool.length > 0) {
            return this._pool.pop()!;
        }

        // 创建新节点
        return this.createDamageNode();
    }

    /**
     * 回收节点到对象池
     */
    private recycleNode(node: Node): void {
        node.active = false;
        this._pool.push(node);
    }

    /**
     * 播放动画
     */
    private playAnimation(
        id: string,
        node: Node,
        type: 'normal' | 'critical' | 'heal' | 'miss'
    ): void {
        const startY = node.position.y;
        const targetY = startY + this.floatHeight;
        const duration = this.floatDuration;

        // 缩放动画（弹出效果）
        tween(node)
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();

        // 位置动画（上浮）
        tween(node)
            .to(duration, {
                position: new Vec3(node.position.x, targetY, 0)
            }, { easing: 'sineOut' })
            .start();

        // 透明度动画（淡出）
        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            tween(opacity)
                .delay(duration * 0.5)
                .to(duration * 0.5, { opacity: 0 })
                .call(() => {
                    this.removeDamage(id);
                })
                .start();
        } else {
            // 没有透明度组件时，直接延迟移除
            this.scheduleOnce(() => {
                this.removeDamage(id);
            }, duration);
        }

        // 暴击特殊效果：抖动
        if (type === 'critical') {
            tween(node)
                .to(0.03, { angle: 10 })
                .to(0.03, { angle: -10 })
                .to(0.03, { angle: 5 })
                .to(0.03, { angle: -5 })
                .to(0.03, { angle: 0 })
                .start();
        }
    }

    /**
     * 移除伤害显示
     */
    private removeDamage(id: string): void {
        const node = this._activeNodes.get(id);
        if (node) {
            this._activeNodes.delete(id);
            this.recycleNode(node);
        }
    }

    /**
     * 清除所有伤害显示
     */
    clearAll(): void {
        this._activeNodes.forEach((node, id) => {
            this.recycleNode(node);
        });
        this._activeNodes.clear();
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.FLOATING_DAMAGE, this.onFloatingDamage, this);
        }

        // 清理对象池
        this._pool.forEach(node => {
            if (node.isValid) {
                node.destroy();
            }
        });
        this._pool = [];

        this._activeNodes.forEach(node => {
            if (node.isValid) {
                node.destroy();
            }
        });
        this._activeNodes.clear();
    }
}
