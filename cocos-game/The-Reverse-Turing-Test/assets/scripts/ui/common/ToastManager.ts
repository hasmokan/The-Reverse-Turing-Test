import { _decorator, Component, Node, Prefab, instantiate, Label, Sprite, Color, tween, Vec3, UIOpacity } from 'cc';
import { GameManager } from '../core/GameManager';
import { ToastMessage, ToastType } from '../data/GameTypes';
import { UI_CONFIG } from '../data/GameConstants';

const { ccclass, property } = _decorator;

/**
 * Toast 消息管理器
 * 迁移自: frontend/src/components/feedback/ToastContainer.tsx
 */
@ccclass('ToastManager')
export class ToastManager extends Component {
    @property(Prefab)
    toastPrefab: Prefab = null!;

    @property(Node)
    container: Node = null!;

    // Toast 颜色配置
    private readonly COLORS: Record<ToastType, Color> = {
        [ToastType.SUCCESS]: new Color(76, 175, 80, 255),    // 绿色
        [ToastType.ERROR]: new Color(244, 67, 54, 255),      // 红色
        [ToastType.WARNING]: new Color(255, 152, 0, 255),    // 橙色
        [ToastType.INFO]: new Color(33, 150, 243, 255),      // 蓝色
        [ToastType.VOTE]: new Color(156, 39, 176, 255),      // 紫色
        [ToastType.ELIMINATE]: new Color(233, 30, 99, 255)   // 粉红
    };

    // 活跃的 Toast 节点
    private _activeToasts: Map<string, Node> = new Map();

    start() {
        this.bindEvents();
    }

    private bindEvents(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.on(GameManager.EVENT.SHOW_TOAST, this.onShowToast, this);
            gm.events.on(GameManager.EVENT.REMOVE_TOAST, this.onRemoveToast, this);
        }
    }

    /**
     * 显示 Toast 事件处理
     */
    private onShowToast(toast: ToastMessage): void {
        this.showToast(toast);
    }

    /**
     * 移除 Toast 事件处理
     */
    private onRemoveToast(id: string): void {
        this.removeToast(id);
    }

    /**
     * 显示 Toast
     */
    showToast(toast: ToastMessage): void {
        if (!this.toastPrefab || !this.container) {
            console.warn('[ToastManager] Prefab or container not set');
            return;
        }

        // 限制最大数量
        if (this._activeToasts.size >= UI_CONFIG.MAX_TOAST_COUNT) {
            // 移除最早的
            const firstId = this._activeToasts.keys().next().value;
            if (firstId) {
                this.removeToast(firstId);
            }
        }

        // 创建 Toast 节点
        const toastNode = instantiate(this.toastPrefab);
        this.container.addChild(toastNode);

        // 设置内容
        const label = toastNode.getChildByName('Label')?.getComponent(Label);
        if (label) {
            label.string = toast.content;
        }

        // 设置颜色
        const bg = toastNode.getChildByName('Background')?.getComponent(Sprite);
        if (bg) {
            bg.color = this.COLORS[toast.type] || this.COLORS[ToastType.INFO];
        }

        // 入场动画
        toastNode.setScale(0.8, 0.8, 1);
        const opacity = toastNode.getComponent(UIOpacity) || toastNode.addComponent(UIOpacity);
        opacity.opacity = 0;

        tween(toastNode)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        tween(opacity)
            .to(0.2, { opacity: 255 })
            .start();

        this._activeToasts.set(toast.id, toastNode);

        // 自动移除 (如果 GameManager 没有处理)
        this.scheduleOnce(() => {
            this.removeToast(toast.id);
        }, (toast.duration || 2000) / 1000);
    }

    /**
     * 移除 Toast
     */
    removeToast(id: string): void {
        const node = this._activeToasts.get(id);
        if (!node || !node.isValid) {
            this._activeToasts.delete(id);
            return;
        }

        // 退场动画
        const opacity = node.getComponent(UIOpacity);

        tween(node)
            .to(0.2, { scale: new Vec3(0.8, 0.8, 1) })
            .start();

        if (opacity) {
            tween(opacity)
                .to(0.2, { opacity: 0 })
                .call(() => {
                    node.destroy();
                    this._activeToasts.delete(id);
                })
                .start();
        } else {
            this.scheduleOnce(() => {
                node.destroy();
                this._activeToasts.delete(id);
            }, 0.2);
        }
    }

    /**
     * 清除所有 Toast
     */
    clearAll(): void {
        this._activeToasts.forEach((node, id) => {
            if (node.isValid) {
                node.destroy();
            }
        });
        this._activeToasts.clear();
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.SHOW_TOAST, this.onShowToast, this);
            gm.events.off(GameManager.EVENT.REMOVE_TOAST, this.onRemoveToast, this);
        }
        this.clearAll();
    }
}
