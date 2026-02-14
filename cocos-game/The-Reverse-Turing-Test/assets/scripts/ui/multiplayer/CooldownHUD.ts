import { _decorator, Component, Node, Sprite, Label, Color, tween, Vec3 } from 'cc';
import { GameManager } from '../../core/GameManager';
import { BattleSystem } from '../../game/BattleSystem';
import { BATTLE_CONSTANTS } from '../../data/GameConstants';

const { ccclass, property } = _decorator;

/**
 * CD 冷却显示 HUD
 * 迁移自: frontend/src/components/hud/CooldownDisplay.tsx
 */
@ccclass('CooldownHUD')
export class CooldownHUD extends Component {
    @property(Sprite)
    progressSprite: Sprite = null!;  // 进度条精灵 (使用 filled 模式)

    @property(Sprite)
    bulletIcon: Sprite = null!;      // 子弹图标

    @property(Label)
    cooldownLabel: Label = null!;    // 显示剩余秒数

    @property(Node)
    readyEffect: Node = null!;       // 准备好特效节点

    // 颜色配置
    private readonly COLOR_READY = new Color(76, 175, 80, 255);     // 绿色 - 可用
    private readonly COLOR_COOLING = new Color(255, 152, 0, 255);   // 橙色 - 冷却中
    private readonly COLOR_LOCKED = new Color(158, 158, 158, 255);  // 灰色 - 锁定

    private _isReady: boolean = true;

    start() {
        this.bindEvents();
        this.updateDisplay();
    }

    private bindEvents(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.on(GameManager.EVENT.BULLET_STATE_CHANGED, this.onBulletStateChanged, this);
        }
    }

    private onBulletStateChanged(): void {
        this.updateDisplay();
    }

    update(dt: number): void {
        // 持续更新冷却进度
        this.updateCooldownProgress();
    }

    /**
     * 更新显示状态
     */
    private updateDisplay(): void {
        const gm = GameManager.instance;
        const bullet = gm.bullet;

        if (bullet.loaded) {
            this.showReady();
        } else {
            this.showCooling();
        }
    }

    /**
     * 显示准备状态
     */
    private showReady(): void {
        if (this._isReady) return;
        this._isReady = true;

        // 更新颜色
        if (this.bulletIcon) {
            this.bulletIcon.color = this.COLOR_READY;
        }
        if (this.progressSprite) {
            this.progressSprite.fillRange = 1;
            this.progressSprite.color = this.COLOR_READY;
        }

        // 隐藏倒计时
        if (this.cooldownLabel) {
            this.cooldownLabel.node.active = false;
        }

        // 播放准备好特效
        this.playReadyEffect();
    }

    /**
     * 显示冷却状态
     */
    private showCooling(): void {
        this._isReady = false;

        // 更新颜色
        if (this.bulletIcon) {
            this.bulletIcon.color = this.COLOR_COOLING;
        }
        if (this.progressSprite) {
            this.progressSprite.color = this.COLOR_COOLING;
        }

        // 显示倒计时
        if (this.cooldownLabel) {
            this.cooldownLabel.node.active = true;
        }
    }

    /**
     * 更新冷却进度
     */
    private updateCooldownProgress(): void {
        if (this._isReady) return;

        const gm = GameManager.instance;
        const bullet = gm.bullet;

        if (!bullet.cooldownEndTime) {
            this.showReady();
            return;
        }

        const now = Date.now();
        const remaining = bullet.cooldownEndTime - now;

        if (remaining <= 0) {
            // CD 结束
            gm.reloadBullet();
            this.showReady();
            return;
        }

        // 更新进度条
        const progress = 1 - (remaining / BATTLE_CONSTANTS.COOLDOWN_DURATION);
        if (this.progressSprite) {
            this.progressSprite.fillRange = progress;
        }

        // 更新倒计时文字
        if (this.cooldownLabel) {
            const seconds = (remaining / 1000).toFixed(1);
            this.cooldownLabel.string = `${seconds}s`;
        }
    }

    /**
     * 播放准备好特效
     */
    private playReadyEffect(): void {
        if (!this.readyEffect) return;

        this.readyEffect.active = true;
        this.readyEffect.setScale(0.5, 0.5, 1);

        tween(this.readyEffect)
            .to(0.2, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .call(() => {
                this.readyEffect.active = false;
            })
            .start();
    }

    // ==================== Getters ====================

    get isReady(): boolean {
        return this._isReady;
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.BULLET_STATE_CHANGED, this.onBulletStateChanged, this);
        }
    }
}
