import { _decorator, Component, Node, Label, Sprite, Color, tween, Vec3, UIOpacity } from 'cc';
import { BATTLE_CONSTANTS } from '../data/GameConstants';

const { ccclass, property } = _decorator;

/**
 * 票数显示组件
 * 显示在鱼身上的票数气泡
 *
 * 使用方式：
 * 1. 创建一个 Prefab，包含背景气泡和票数 Label
 * 2. 将此脚本挂载到 Prefab 根节点
 * 3. 在 FishController 中引用此组件
 */
@ccclass('VoteDisplay')
export class VoteDisplay extends Component {
    // ==================== UI 引用 ====================

    @property(Sprite)
    backgroundSprite: Sprite = null!;      // 背景气泡精灵

    @property(Label)
    countLabel: Label = null!;             // 票数标签

    @property(Node)
    progressRing: Node = null!;            // 进度环（可选，显示接近淘汰的进度）

    @property(Sprite)
    progressFill: Sprite = null!;          // 进度填充（使用 filled 模式）

    // ==================== 颜色配置 ====================

    private readonly COLOR_LOW = new Color(76, 175, 80, 255);       // 绿色 - 低票数 (1-2)
    private readonly COLOR_MEDIUM = new Color(255, 193, 7, 255);    // 黄色 - 中等票数 (3)
    private readonly COLOR_HIGH = new Color(244, 67, 54, 255);      // 红色 - 高票数 (4+)
    private readonly COLOR_CRITICAL = new Color(183, 28, 28, 255);  // 深红 - 即将淘汰

    // ==================== 状态 ====================

    private _currentCount: number = 0;
    private _isAnimating: boolean = false;
    private _pulseAnimation: any = null;

    // ==================== 生命周期 ====================

    onLoad() {
        // 初始隐藏
        this.node.active = false;
    }

    // ==================== 公共方法 ====================

    /**
     * 更新票数显示
     * @param count 当前票数
     * @param animate 是否播放动画
     */
    updateCount(count: number, animate: boolean = true): void {
        const previousCount = this._currentCount;
        this._currentCount = count;

        // 显示/隐藏
        if (count <= 0) {
            this.hide();
            return;
        }

        this.show();

        // 更新票数文字
        if (this.countLabel) {
            this.countLabel.string = `${count}`;
        }

        // 更新颜色
        this.updateColor(count);

        // 更新进度环
        this.updateProgress(count);

        // 播放动画
        if (animate && count !== previousCount) {
            if (count > previousCount) {
                this.playIncreaseAnimation();
            } else {
                this.playDecreaseAnimation();
            }
        }

        // 高票数时启动脉冲动画
        if (count >= BATTLE_CONSTANTS.ELIMINATION_THRESHOLD - 1) {
            this.startPulseAnimation();
        } else {
            this.stopPulseAnimation();
        }
    }

    /**
     * 显示组件
     */
    show(): void {
        if (this.node.active) return;

        this.node.active = true;
        this.node.setScale(0, 0, 1);

        // 入场动画
        tween(this.node)
            .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }

    /**
     * 隐藏组件
     */
    hide(): void {
        if (!this.node.active) return;

        this.stopPulseAnimation();

        // 退场动画
        tween(this.node)
            .to(0.15, { scale: new Vec3(0, 0, 1) }, { easing: 'backIn' })
            .call(() => {
                this.node.active = false;
                this._currentCount = 0;
            })
            .start();
    }

    /**
     * 获取当前票数
     */
    getCount(): number {
        return this._currentCount;
    }

    // ==================== 私有方法 ====================

    /**
     * 更新颜色
     */
    private updateColor(count: number): void {
        let color: Color;

        if (count >= BATTLE_CONSTANTS.ELIMINATION_THRESHOLD) {
            color = this.COLOR_CRITICAL;
        } else if (count >= BATTLE_CONSTANTS.ELIMINATION_THRESHOLD - 1) {
            color = this.COLOR_HIGH;
        } else if (count >= 2) {
            color = this.COLOR_MEDIUM;
        } else {
            color = this.COLOR_LOW;
        }

        // 更新背景颜色
        if (this.backgroundSprite) {
            this.backgroundSprite.color = color;
        }

        // 更新进度环颜色
        if (this.progressFill) {
            this.progressFill.color = color;
        }
    }

    /**
     * 更新进度环
     */
    private updateProgress(count: number): void {
        if (!this.progressFill) return;

        const progress = Math.min(1, count / BATTLE_CONSTANTS.ELIMINATION_THRESHOLD);
        this.progressFill.fillRange = progress;

        // 显示/隐藏进度环
        if (this.progressRing) {
            this.progressRing.active = count > 0;
        }
    }

    /**
     * 播放票数增加动画
     */
    private playIncreaseAnimation(): void {
        if (this._isAnimating) return;
        this._isAnimating = true;

        const originalScale = this.node.scale.clone();

        tween(this.node)
            .to(0.1, { scale: new Vec3(1.3, 1.3, 1) })
            .to(0.1, { scale: originalScale })
            .call(() => {
                this._isAnimating = false;
            })
            .start();

        // 票数标签抖动
        if (this.countLabel?.node) {
            tween(this.countLabel.node)
                .to(0.05, { angle: 10 })
                .to(0.05, { angle: -10 })
                .to(0.05, { angle: 5 })
                .to(0.05, { angle: 0 })
                .start();
        }
    }

    /**
     * 播放票数减少动画
     */
    private playDecreaseAnimation(): void {
        if (this._isAnimating) return;
        this._isAnimating = true;

        const originalScale = this.node.scale.clone();

        tween(this.node)
            .to(0.1, { scale: new Vec3(0.8, 0.8, 1) })
            .to(0.15, { scale: originalScale }, { easing: 'backOut' })
            .call(() => {
                this._isAnimating = false;
            })
            .start();
    }

    /**
     * 启动脉冲动画（高票数警告）
     */
    private startPulseAnimation(): void {
        if (this._pulseAnimation) return;

        const pulse = () => {
            if (!this.node.active || this._currentCount < BATTLE_CONSTANTS.ELIMINATION_THRESHOLD - 1) {
                this._pulseAnimation = null;
                return;
            }

            this._pulseAnimation = tween(this.node)
                .to(0.4, { scale: new Vec3(1.1, 1.1, 1) })
                .to(0.4, { scale: new Vec3(1, 1, 1) })
                .call(() => {
                    pulse();
                })
                .start();
        };

        pulse();
    }

    /**
     * 停止脉冲动画
     */
    private stopPulseAnimation(): void {
        if (this._pulseAnimation) {
            this._pulseAnimation = null;
            this.node.setScale(1, 1, 1);
        }
    }

    // ==================== 静态工厂方法 ====================

    /**
     * 创建简单的票数显示（不使用 Prefab）
     * 用于快速测试
     */
    static createSimple(parent: Node): VoteDisplay {
        const node = new Node('VoteDisplay');
        parent.addChild(node);

        // 添加组件
        const display = node.addComponent(VoteDisplay);

        // 这里可以通过代码创建简单的 UI
        // 实际使用时建议使用 Prefab

        return display;
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        this.stopPulseAnimation();
    }
}
