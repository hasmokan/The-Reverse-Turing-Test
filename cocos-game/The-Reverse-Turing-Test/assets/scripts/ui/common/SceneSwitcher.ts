import { _decorator, Component, Button, director, log as ccLog, warn as ccWarn, error as ccError } from 'cc';
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
            ccWarn('未设置目标场景名称');
            return;
        }

        this.switchWithFallback(
            this.targetScene,
            this.transitionType as TransitionType,
            this.transitionDuration
        );
    }

    /**
     * 直接调用方法切换场景（供其他脚本调用）
     */
    public switchToScene(sceneName: string, type?: TransitionType, duration?: number) {
        this.switchWithFallback(
            sceneName,
            type || this.transitionType as TransitionType,
            duration || this.transitionDuration
        );
    }

    private switchWithFallback(sceneName: string, type: TransitionType, duration: number): void {
        const transition = SceneTransition.instance;
        if (!transition || !transition.isValid) {
            ccError('SceneTransition 实例未找到，降级为直接切换场景');
            director.loadScene(sceneName);
            return;
        }

        ccLog(`切换到场景: ${sceneName}`);
        transition.loadScene(sceneName, type, duration);
    }
}
