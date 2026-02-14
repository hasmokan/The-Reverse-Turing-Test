import {
    _decorator, Component, Sprite, UIOpacity, Color, tween, UITransform, Size
} from 'cc';
import { GameManager } from '../../core/GameManager';

const { ccclass } = _decorator;

/**
 * 被攻击红色光晕效果
 * 监听 BEING_ATTACKED 事件
 * 屏幕边缘红色半透明遮罩，呼吸闪烁一次后消失
 */
@ccclass('VictimGlowEffect')
export class VictimGlowEffect extends Component {

    private _opacity: UIOpacity | null = null;
    private _isPlaying: boolean = false;

    onLoad() {
        // 设置全屏红色遮罩
        const sprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = new Color(255, 0, 0, 80);

        const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        transform.setContentSize(new Size(750, 1334));
        transform.setAnchorPoint(0.5, 0.5);

        this._opacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        this._opacity.opacity = 0;

        // 点击穿透 - 不阻挡触摸事件
        sprite.enabled = true;
    }

    start() {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.on(GameManager.EVENT.BEING_ATTACKED, this.onBeingAttacked, this);
        }
    }

    /**
     * 被攻击时触发
     */
    private onBeingAttacked(): void {
        if (this._isPlaying || !this._opacity) return;
        this._isPlaying = true;

        // 呼吸闪烁一次后消失
        tween(this._opacity)
            .to(0.2, { opacity: 120 })
            .to(0.3, { opacity: 40 })
            .to(0.2, { opacity: 100 })
            .to(0.4, { opacity: 0 })
            .call(() => {
                this._isPlaying = false;
            })
            .start();
    }

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.BEING_ATTACKED, this.onBeingAttacked, this);
        }
    }
}
