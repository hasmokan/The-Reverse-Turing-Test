import { _decorator, Component, Node, Label, Sprite, Color, tween, Vec3, ProgressBar } from 'cc';
import { GameManager } from '../core/GameManager';
import { GamePhase } from '../data/GameTypes';
import { BATTLE_CONSTANTS } from '../data/GameConstants';

const { ccclass, property } = _decorator;

/**
 * 游戏信息 HUD
 * 显示游戏状态信息：AI数量、玩家数量、游戏阶段、浑浊度
 */
@ccclass('GameInfoHUD')
export class GameInfoHUD extends Component {
    // ==================== UI 引用 ====================

    @property(Label)
    aiCountLabel: Label = null!;           // AI 数量标签

    @property(Label)
    humanCountLabel: Label = null!;        // 玩家数量标签

    @property(Label)
    phaseLabel: Label = null!;             // 游戏阶段标签

    @property(ProgressBar)
    turbidityBar: ProgressBar = null!;     // 浑浊度进度条

    @property(Label)
    turbidityLabel: Label = null!;         // 浑浊度百分比标签

    @property(Node)
    warningIcon: Node = null!;             // 危险警告图标

    @property(Sprite)
    aiIcon: Sprite = null!;                // AI 图标

    @property(Sprite)
    humanIcon: Sprite = null!;             // 玩家图标

    // ==================== 颜色配置 ====================

    private readonly COLOR_SAFE = new Color(76, 175, 80, 255);      // 绿色 - 安全
    private readonly COLOR_WARNING = new Color(255, 193, 7, 255);   // 黄色 - 警告
    private readonly COLOR_DANGER = new Color(244, 67, 54, 255);    // 红色 - 危险

    // ==================== 阶段名称映射 ====================

    private readonly PHASE_NAMES: Record<GamePhase, string> = {
        [GamePhase.LOBBY]: '等待中',
        [GamePhase.DRAWING]: '绘画阶段',
        [GamePhase.VIEWING]: '观察阶段',
        [GamePhase.VOTING]: '投票阶段',
        [GamePhase.RESULT]: '结算中',
        [GamePhase.GAMEOVER]: '游戏结束'
    };

    // ==================== 状态 ====================

    private _lastAiCount: number = -1;
    private _lastHumanCount: number = -1;
    private _isWarningAnimating: boolean = false;

    // ==================== 生命周期 ====================

    start() {
        this.bindEvents();
        this.updateAllDisplay();
    }

    /**
     * 绑定事件
     */
    private bindEvents(): void {
        const gm = GameManager.instance;
        if (!gm) return;

        // 监听游戏状态变化
        gm.events.on(GameManager.EVENT.PHASE_CHANGED, this.onPhaseChanged, this);
        gm.events.on(GameManager.EVENT.ITEM_ADDED, this.onItemsChanged, this);
        gm.events.on(GameManager.EVENT.ITEM_REMOVED, this.onItemsChanged, this);
        gm.events.on(GameManager.EVENT.SYNCED, this.onSynced, this);
    }

    /**
     * 阶段变化事件
     */
    private onPhaseChanged(newPhase: GamePhase, oldPhase: GamePhase): void {
        this.updatePhaseDisplay();
        this.playPhaseChangeAnimation();
    }

    /**
     * 物品变化事件
     */
    private onItemsChanged(): void {
        this.updateCountDisplay();
        this.updateTurbidityDisplay();
    }

    /**
     * 同步完成事件
     */
    private onSynced(): void {
        this.updateAllDisplay();
    }

    // ==================== 显示更新 ====================

    /**
     * 更新所有显示
     */
    updateAllDisplay(): void {
        this.updateCountDisplay();
        this.updatePhaseDisplay();
        this.updateTurbidityDisplay();
    }

    /**
     * 更新数量显示
     */
    updateCountDisplay(): void {
        const gm = GameManager.instance;
        if (!gm) return;

        const aiCount = gm.aiCount;
        const items = gm.items;
        const humanCount = items.filter(item => !item.isAI).length;

        // AI 数量
        if (this.aiCountLabel) {
            this.aiCountLabel.string = `${aiCount}`;

            // 根据 AI 数量设置颜色
            if (aiCount >= BATTLE_CONSTANTS.DEFEAT_MAX_AI_COUNT) {
                this.aiCountLabel.color = this.COLOR_DANGER;
            } else if (aiCount >= BATTLE_CONSTANTS.DEFEAT_MAX_AI_COUNT - 2) {
                this.aiCountLabel.color = this.COLOR_WARNING;
            } else {
                this.aiCountLabel.color = this.COLOR_SAFE;
            }
        }

        // 玩家数量
        if (this.humanCountLabel) {
            this.humanCountLabel.string = `${humanCount}`;

            // 根据玩家数量设置颜色
            if (humanCount <= BATTLE_CONSTANTS.VICTORY_MIN_HUMAN_COUNT) {
                this.humanCountLabel.color = this.COLOR_WARNING;
            } else {
                this.humanCountLabel.color = this.COLOR_SAFE;
            }
        }

        // 播放数量变化动画
        if (aiCount !== this._lastAiCount && this._lastAiCount !== -1) {
            this.playCountChangeAnimation(this.aiCountLabel?.node, aiCount > this._lastAiCount);
        }
        if (humanCount !== this._lastHumanCount && this._lastHumanCount !== -1) {
            this.playCountChangeAnimation(this.humanCountLabel?.node, humanCount < this._lastHumanCount);
        }

        this._lastAiCount = aiCount;
        this._lastHumanCount = humanCount;
    }

    /**
     * 更新阶段显示
     */
    updatePhaseDisplay(): void {
        const gm = GameManager.instance;
        if (!gm || !this.phaseLabel) return;

        const phase = gm.phase;
        this.phaseLabel.string = this.PHASE_NAMES[phase] || '未知';

        // 根据阶段设置颜色
        switch (phase) {
            case GamePhase.VOTING:
                this.phaseLabel.color = this.COLOR_WARNING;
                break;
            case GamePhase.GAMEOVER:
                this.phaseLabel.color = this.COLOR_DANGER;
                break;
            default:
                this.phaseLabel.color = Color.WHITE;
        }
    }

    /**
     * 更新浑浊度显示
     */
    updateTurbidityDisplay(): void {
        const gm = GameManager.instance;
        if (!gm) return;

        const turbidity = gm.turbidity;

        // 更新进度条
        if (this.turbidityBar) {
            this.turbidityBar.progress = turbidity;

            // 根据浑浊度设置颜色
            const barSprite = this.turbidityBar.barSprite;
            if (barSprite) {
                if (turbidity >= 0.8) {
                    barSprite.color = this.COLOR_DANGER;
                } else if (turbidity >= 0.5) {
                    barSprite.color = this.COLOR_WARNING;
                } else {
                    barSprite.color = this.COLOR_SAFE;
                }
            }
        }

        // 更新百分比标签
        if (this.turbidityLabel) {
            const percent = Math.floor(turbidity * 100);
            this.turbidityLabel.string = `${percent}%`;
        }

        // 危险警告
        this.updateWarningState(turbidity);
    }

    /**
     * 更新警告状态
     */
    private updateWarningState(turbidity: number): void {
        if (!this.warningIcon) return;

        const isDanger = turbidity >= 0.8;
        this.warningIcon.active = isDanger;

        // 危险时播放闪烁动画
        if (isDanger && !this._isWarningAnimating) {
            this.playWarningAnimation();
        }
    }

    // ==================== 动画效果 ====================

    /**
     * 播放数量变化动画
     */
    private playCountChangeAnimation(node: Node | null, isNegative: boolean): void {
        if (!node) return;

        const originalScale = node.scale.clone();

        tween(node)
            .to(0.1, { scale: new Vec3(1.3, 1.3, 1) })
            .to(0.1, { scale: originalScale })
            .start();
    }

    /**
     * 播放阶段变化动画
     */
    private playPhaseChangeAnimation(): void {
        if (!this.phaseLabel?.node) return;

        const node = this.phaseLabel.node;
        const originalScale = node.scale.clone();

        tween(node)
            .to(0.15, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: originalScale })
            .start();
    }

    /**
     * 播放警告闪烁动画
     */
    private playWarningAnimation(): void {
        if (!this.warningIcon || this._isWarningAnimating) return;

        this._isWarningAnimating = true;

        const blink = () => {
            if (!this.warningIcon?.active) {
                this._isWarningAnimating = false;
                return;
            }

            tween(this.warningIcon)
                .to(0.3, { scale: new Vec3(1.2, 1.2, 1) })
                .to(0.3, { scale: new Vec3(1, 1, 1) })
                .call(() => {
                    if (this.warningIcon?.active) {
                        blink();
                    } else {
                        this._isWarningAnimating = false;
                    }
                })
                .start();
        };

        blink();
    }

    // ==================== 公共方法 ====================

    /**
     * 显示临时消息
     */
    showMessage(message: string, duration: number = 2000): void {
        if (!this.phaseLabel) return;

        const originalText = this.phaseLabel.string;

        this.phaseLabel.string = message;
        this.playPhaseChangeAnimation();

        this.scheduleOnce(() => {
            if (this.phaseLabel) {
                this.phaseLabel.string = originalText;
            }
        }, duration / 1000);
    }

    /**
     * 设置可见性
     */
    setVisible(visible: boolean): void {
        this.node.active = visible;
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.PHASE_CHANGED, this.onPhaseChanged, this);
            gm.events.off(GameManager.EVENT.ITEM_ADDED, this.onItemsChanged, this);
            gm.events.off(GameManager.EVENT.ITEM_REMOVED, this.onItemsChanged, this);
            gm.events.off(GameManager.EVENT.SYNCED, this.onSynced, this);
        }
    }
}
