import { _decorator, Component, Node, Label, Sprite, Button, Color,
         tween, Vec3, UIOpacity, ParticleSystem2D } from 'cc';
import { GameManager } from '../core/GameManager';
import { GameResult, GamePhase, ToastType } from '../data/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 游戏结果面板
 * 游戏结束时显示胜利/失败结果
 *
 * 功能：
 * - 显示胜利/失败状态
 * - 显示 MVP 玩家（胜利时）
 * - 显示统计数据（AI剩余、人类剩余）
 * - 显示失败原因
 * - 提供重新开始/返回大厅按钮
 */
@ccclass('GameResultPanel')
export class GameResultPanel extends Component {
    // ==================== UI 引用 ====================

    @property(Node)
    panelRoot: Node = null!;               // 面板根节点

    @property(Node)
    maskNode: Node = null!;                // 背景遮罩

    // 标题区域
    @property(Label)
    titleLabel: Label = null!;             // 标题（胜利/失败）

    @property(Sprite)
    titleIcon: Sprite = null!;             // 标题图标

    @property(Node)
    victoryEffects: Node = null!;          // 胜利特效容器

    @property(Node)
    defeatEffects: Node = null!;           // 失败特效容器

    // MVP 区域（胜利时显示）
    @property(Node)
    mvpSection: Node = null!;              // MVP 区域

    @property(Label)
    mvpNameLabel: Label = null!;           // MVP 名称

    @property(Sprite)
    mvpAvatar: Sprite = null!;             // MVP 头像

    @property(Label)
    mvpTitleLabel: Label = null!;          // MVP 称号

    // 统计区域
    @property(Node)
    statsSection: Node = null!;            // 统计区域

    @property(Label)
    aiRemainingLabel: Label = null!;       // AI 剩余数量

    @property(Label)
    humanRemainingLabel: Label = null!;    // 人类剩余数量

    @property(Label)
    humanKilledLabel: Label = null!;       // 误杀人类数量（失败时）

    // 失败原因
    @property(Node)
    reasonSection: Node = null!;           // 失败原因区域

    @property(Label)
    reasonLabel: Label = null!;            // 失败原因文字

    // 按钮
    @property(Button)
    restartButton: Button = null!;         // 重新开始按钮

    @property(Button)
    lobbyButton: Button = null!;           // 返回大厅按钮

    @property(Button)
    shareButton: Button = null!;           // 分享按钮

    // ==================== 颜色配置 ====================

    private readonly COLOR_VICTORY = new Color(76, 175, 80, 255);   // 绿色 - 胜利
    private readonly COLOR_DEFEAT = new Color(244, 67, 54, 255);    // 红色 - 失败
    private readonly COLOR_GOLD = new Color(255, 215, 0, 255);      // 金色 - MVP

    // ==================== 失败原因映射 ====================

    private readonly DEFEAT_REASONS: Record<string, string> = {
        'ai_majority': 'AI 数量超过了安全阈值！',
        'too_many_human_killed': '误杀了太多人类玩家...',
        'timeout': '时间耗尽，AI 占领了鱼塘！',
        'default': '游戏失败'
    };

    // ==================== 状态 ====================

    private _isVisible: boolean = false;
    private _currentResult: GameResult | null = null;

    // ==================== 生命周期 ====================

    start() {
        this.bindEvents();
        this.hide(false);
    }

    /**
     * 绑定事件
     */
    private bindEvents(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.on(GameManager.EVENT.GAME_RESULT, this.onGameResult, this);
        }

        // 按钮事件
        if (this.restartButton) {
            this.restartButton.node.on(Button.EventType.CLICK, this.onRestartClick, this);
        }
        if (this.lobbyButton) {
            this.lobbyButton.node.on(Button.EventType.CLICK, this.onLobbyClick, this);
        }
        if (this.shareButton) {
            this.shareButton.node.on(Button.EventType.CLICK, this.onShareClick, this);
        }
    }

    // ==================== 事件处理 ====================

    /**
     * 游戏结果事件
     */
    private onGameResult(result: GameResult): void {
        this.showResult(result);
    }

    /**
     * 重新开始按钮
     */
    private onRestartClick(): void {
        this.hide();
        // TODO: 发送重新开始请求
        GameManager.instance.showToast(ToastType.INFO, '正在重新开始...');
    }

    /**
     * 返回大厅按钮
     */
    private onLobbyClick(): void {
        this.hide();
        GameManager.instance.resetGame();
        // TODO: 切换到大厅场景
        GameManager.instance.showToast(ToastType.INFO, '返回大厅...');
    }

    /**
     * 分享按钮
     */
    private onShareClick(): void {
        // TODO: 调用分享功能
        GameManager.instance.showToast(ToastType.INFO, '分享功能开发中...');
    }

    // ==================== 显示控制 ====================

    /**
     * 显示游戏结果
     */
    showResult(result: GameResult): void {
        this._currentResult = result;

        // 更新显示
        if (result.isVictory) {
            this.showVictory(result);
        } else {
            this.showDefeat(result);
        }

        // 显示面板
        this.show();
    }

    /**
     * 显示胜利界面
     */
    private showVictory(result: GameResult): void {
        // 标题
        if (this.titleLabel) {
            this.titleLabel.string = '🎉 胜利！';
            this.titleLabel.color = this.COLOR_VICTORY;
        }

        // 特效
        if (this.victoryEffects) {
            this.victoryEffects.active = true;
            this.playVictoryEffects();
        }
        if (this.defeatEffects) {
            this.defeatEffects.active = false;
        }

        // MVP 区域
        if (this.mvpSection) {
            this.mvpSection.active = !!result.mvpPlayerName;

            if (result.mvpPlayerName && this.mvpNameLabel) {
                this.mvpNameLabel.string = result.mvpPlayerName;
                this.mvpNameLabel.color = this.COLOR_GOLD;
            }

            if (this.mvpTitleLabel) {
                this.mvpTitleLabel.string = '🏆 最有价值玩家';
            }
        }

        // 隐藏失败原因
        if (this.reasonSection) {
            this.reasonSection.active = false;
        }

        // 统计
        this.updateStats(result);
    }

    /**
     * 显示失败界面
     */
    private showDefeat(result: GameResult): void {
        // 标题
        if (this.titleLabel) {
            this.titleLabel.string = '💀 失败...';
            this.titleLabel.color = this.COLOR_DEFEAT;
        }

        // 特效
        if (this.victoryEffects) {
            this.victoryEffects.active = false;
        }
        if (this.defeatEffects) {
            this.defeatEffects.active = true;
            this.playDefeatEffects();
        }

        // 隐藏 MVP
        if (this.mvpSection) {
            this.mvpSection.active = false;
        }

        // 失败原因
        if (this.reasonSection) {
            this.reasonSection.active = true;

            if (this.reasonLabel) {
                const reason = result.reason || 'default';
                this.reasonLabel.string = this.DEFEAT_REASONS[reason] || this.DEFEAT_REASONS['default'];
            }
        }

        // 误杀数量
        if (this.humanKilledLabel && result.humanKilled !== undefined) {
            this.humanKilledLabel.node.active = true;
            this.humanKilledLabel.string = `误杀人类: ${result.humanKilled}`;
            this.humanKilledLabel.color = this.COLOR_DEFEAT;
        } else if (this.humanKilledLabel) {
            this.humanKilledLabel.node.active = false;
        }

        // 统计
        this.updateStats(result);
    }

    /**
     * 更新统计数据
     */
    private updateStats(result: GameResult): void {
        // AI 剩余
        if (this.aiRemainingLabel) {
            this.aiRemainingLabel.string = `AI 剩余: ${result.aiRemaining}`;

            if (result.aiRemaining === 0) {
                this.aiRemainingLabel.color = this.COLOR_VICTORY;
            } else {
                this.aiRemainingLabel.color = this.COLOR_DEFEAT;
            }
        }

        // 人类剩余
        if (this.humanRemainingLabel) {
            this.humanRemainingLabel.string = `人类剩余: ${result.humanRemaining}`;
            this.humanRemainingLabel.color = Color.WHITE;
        }
    }

    /**
     * 显示面板
     */
    show(): void {
        if (this._isVisible) return;
        this._isVisible = true;

        this.node.active = true;

        // 遮罩淡入
        if (this.maskNode) {
            const maskOpacity = this.maskNode.getComponent(UIOpacity) || this.maskNode.addComponent(UIOpacity);
            maskOpacity.opacity = 0;
            tween(maskOpacity)
                .to(0.3, { opacity: 200 })
                .start();
        }

        // 面板弹出
        if (this.panelRoot) {
            this.panelRoot.setScale(0.5, 0.5, 1);
            this.panelRoot.setPosition(0, -100, 0);
            const panelOpacity = this.panelRoot.getComponent(UIOpacity) || this.panelRoot.addComponent(UIOpacity);
            panelOpacity.opacity = 0;

            tween(this.panelRoot)
                .to(0.4, {
                    scale: new Vec3(1, 1, 1),
                    position: new Vec3(0, 0, 0)
                }, { easing: 'backOut' })
                .start();

            tween(panelOpacity)
                .to(0.3, { opacity: 255 })
                .start();
        }

        // 延迟显示按钮
        this.scheduleOnce(() => {
            this.showButtons();
        }, 0.5);
    }

    /**
     * 显示按钮（带动画）
     */
    private showButtons(): void {
        const buttons = [this.restartButton?.node, this.lobbyButton?.node, this.shareButton?.node];

        buttons.forEach((btn, index) => {
            if (!btn) return;

            btn.setScale(0, 0, 1);
            btn.active = true;

            tween(btn)
                .delay(index * 0.1)
                .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        });
    }

    /**
     * 隐藏面板
     */
    hide(animate: boolean = true): void {
        if (!this._isVisible && animate) return;
        this._isVisible = false;

        if (!animate) {
            this.node.active = false;
            this._currentResult = null;
            return;
        }

        // 遮罩淡出
        if (this.maskNode) {
            const maskOpacity = this.maskNode.getComponent(UIOpacity);
            if (maskOpacity) {
                tween(maskOpacity)
                    .to(0.2, { opacity: 0 })
                    .start();
            }
        }

        // 面板收起
        if (this.panelRoot) {
            tween(this.panelRoot)
                .to(0.2, {
                    scale: new Vec3(0.8, 0.8, 1),
                    position: new Vec3(0, 50, 0)
                })
                .call(() => {
                    this.node.active = false;
                    this._currentResult = null;
                })
                .start();
        } else {
            this.node.active = false;
            this._currentResult = null;
        }
    }

    // ==================== 特效 ====================

    /**
     * 播放胜利特效
     */
    private playVictoryEffects(): void {
        if (!this.victoryEffects) return;

        // 标题弹跳
        if (this.titleLabel?.node) {
            tween(this.titleLabel.node)
                .to(0.3, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
                .to(0.2, { scale: new Vec3(1, 1, 1) })
                .start();
        }

        // 粒子效果
        const particles = this.victoryEffects.getComponentsInChildren(ParticleSystem2D);
        particles.forEach(p => p.resetSystem());

        // 彩带/星星动画
        // TODO: 添加更多胜利特效
    }

    /**
     * 播放失败特效
     */
    private playDefeatEffects(): void {
        if (!this.defeatEffects) return;

        // 标题抖动
        if (this.titleLabel?.node) {
            tween(this.titleLabel.node)
                .to(0.05, { angle: 5 })
                .to(0.05, { angle: -5 })
                .to(0.05, { angle: 3 })
                .to(0.05, { angle: -3 })
                .to(0.05, { angle: 0 })
                .start();
        }

        // 屏幕震动效果
        if (this.panelRoot) {
            const originalPos = this.panelRoot.position.clone();
            tween(this.panelRoot)
                .to(0.03, { position: new Vec3(originalPos.x + 5, originalPos.y, 0) })
                .to(0.03, { position: new Vec3(originalPos.x - 5, originalPos.y, 0) })
                .to(0.03, { position: new Vec3(originalPos.x + 3, originalPos.y, 0) })
                .to(0.03, { position: new Vec3(originalPos.x - 3, originalPos.y, 0) })
                .to(0.03, { position: originalPos })
                .start();
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 获取当前结果
     */
    getCurrentResult(): GameResult | null {
        return this._currentResult;
    }

    /**
     * 是否可见
     */
    isVisible(): boolean {
        return this._isVisible;
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.GAME_RESULT, this.onGameResult, this);
        }
    }
}
