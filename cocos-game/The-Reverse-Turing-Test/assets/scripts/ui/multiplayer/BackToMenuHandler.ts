import { _decorator, Component, Button, log as ccLog, warn as ccWarn } from 'cc';
import { SceneTransition, TransitionType } from '../../core/SceneTransition';
const { ccclass, property } = _decorator;

/**
 * 返回主菜单按钮处理器
 * 处理从游戏场景返回主菜单的逻辑
 */
@ccclass('BackToMenuHandler')
export class BackToMenuHandler extends Component {
    @property(Button)
    backButton: Button = null!;

    onLoad() {
        // 绑定按钮点击事件
        if (this.backButton) {
            this.backButton.node.on(Button.EventType.CLICK, this.onBackClick, this);
        }
    }

    /**
     * 点击返回按钮
     */
    private onBackClick() {
        ccLog('返回主菜单');

        // 使用淡入淡出效果返回主菜单
        if (SceneTransition.instance) {
            SceneTransition.instance.loadScene('MainScene', TransitionType.FADE, 0.8);
        } else {
            ccWarn('SceneTransition 实例不存在，使用默认方式切换场景');
            // 降级处理：直接切换场景
            const { director } = require('cc');
            director.loadScene('MainScene');
        }
    }

    onDestroy() {
        // 移除事件监听
        if (this.backButton && this.backButton.isValid && this.backButton.node) {
            this.backButton.node.off(Button.EventType.CLICK, this.onBackClick, this);
        }
    }
}
