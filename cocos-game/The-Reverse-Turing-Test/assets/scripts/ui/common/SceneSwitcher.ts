import { _decorator, Component, Button } from 'cc';
import { SceneTransition, TransitionType } from '../../core/SceneTransition';

const { ccclass, property } = _decorator;

/**
 * 场景切换按钮控制器
 * 用于在主菜单和其他场景之间切换
 */
@ccclass('SceneSwitcher')
export class SceneSwitcher extends Component {
    @property({ type: String })
    targetScene: string = '';

    @property({ type: String, tooltip: '转场类型: fade / slide_left / slide_right / zoom / circle' })
    transitionType: string = TransitionType.FADE;

    @property({ type: Number })
    transitionDuration: number = 0.5;

    onLoad() {
        const button = this.node.getComponent(Button);
        if (button) {
            button.node.on(Button.EventType.CLICK, this.onButtonClick, this);
        }
    }

    onDestroy() {
        const button = this.node.getComponent(Button);
        if (button && button.node) {
            button.node.off(Button.EventType.CLICK, this.onButtonClick, this);
        }
    }

    private onButtonClick() {
        if (!this.targetScene) {
            console.warn('未设置目标场景名称');
            return;
        }

        if (!SceneTransition.instance) {
            console.error('SceneTransition 实例未找到！');
            return;
        }

        console.log(`切换到场景: ${this.targetScene}`);
        SceneTransition.instance.loadScene(
            this.targetScene,
            this.transitionType as TransitionType,
            this.transitionDuration
        );
    }

    /**
     * 直接调用方法切换场景（供其他脚本调用）
     */
    public switchToScene(sceneName: string, type?: TransitionType, duration?: number) {
        if (!SceneTransition.instance) {
            console.error('SceneTransition 实例未找到！');
            return;
        }

        SceneTransition.instance.loadScene(
            sceneName,
            type || this.transitionType as TransitionType,
            duration || this.transitionDuration
        );
    }
}
