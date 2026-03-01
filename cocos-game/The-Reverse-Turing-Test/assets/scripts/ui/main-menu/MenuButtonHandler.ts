import { _decorator, Component, Node, Button, director, log as ccLog, error as ccError } from 'cc';
import { SceneTransition, TransitionType } from '../../core/SceneTransition';
const { ccclass, property } = _decorator;

/**
 * 主菜单按钮处理器
 * 处理首页各按钮的点击事件
 */
@ccclass('MenuButtonHandler')
export class MenuButtonHandler extends Component {
    @property(Button)
    singlePlayerButton: Button = null!;

    @property(Button)
    multiPlayerButton: Button = null!;

    @property(Button)
    rankingButton: Button = null!;

    @property(Button)
    profileButton: Button = null!;

    onLoad() {
        this.bindButtonClick(this.singlePlayerButton, this.onSinglePlayerClick);
        this.bindButtonClick(this.multiPlayerButton, this.onMultiPlayerClick);
        this.bindButtonClick(this.rankingButton, this.onRankingClick);
        this.bindButtonClick(this.profileButton, this.onProfileClick);
    }

    /**
     * 点击单人游戏
     */
    private onSinglePlayerClick() {
        ccLog('点击单人游戏');
        this.loadSceneWithFallback('MultiPlayerScene', TransitionType.FADE, 0.8);
    }

    /**
     * 点击深海鱼缸（多人）
     */
    private onMultiPlayerClick() {
        ccLog('点击深海鱼缸（多人）');
        this.loadSceneWithFallback('MultiPlayerScene', TransitionType.SLIDE_LEFT, 0.8);
    }

    /**
     * 点击排行榜
     */
    private onRankingClick() {
        ccLog('点击排行榜');
        this.loadSceneWithFallback('RankingScene', TransitionType.ZOOM, 0.8);
    }

    /**
     * 点击个人中心
     */
    private onProfileClick() {
        ccLog('点击个人中心（场景未开放，返回主菜单）');
        this.loadSceneWithFallback('MainScene', TransitionType.SLIDE_RIGHT, 0.8);
    }

    onDestroy() {
        this.unbindButtonClick(this.singlePlayerButton, this.onSinglePlayerClick);
        this.unbindButtonClick(this.multiPlayerButton, this.onMultiPlayerClick);
        this.unbindButtonClick(this.rankingButton, this.onRankingClick);
        this.unbindButtonClick(this.profileButton, this.onProfileClick);
    }

    private resolveButtonNode(button: Button | null): Node | null {
        if (!button || !button.isValid) {
            return null;
        }

        const node = button.node;
        return node && node.isValid ? node : null;
    }

    private bindButtonClick(button: Button | null, handler: () => void): void {
        const node = this.resolveButtonNode(button);
        if (!node) {
            return;
        }

        node.on(Button.EventType.CLICK, handler, this);
    }

    private unbindButtonClick(button: Button | null, handler: () => void): void {
        const node = this.resolveButtonNode(button);
        if (!node) {
            return;
        }

        node.off(Button.EventType.CLICK, handler, this);
    }

    private loadSceneWithFallback(sceneName: string, type: TransitionType, duration: number): void {
        const transition = SceneTransition.instance;
        if (!transition || !transition.isValid) {
            ccError('SceneTransition 实例未找到，降级为直接切换场景');
            director.loadScene(sceneName);
            return;
        }

        transition.loadScene(sceneName, type, duration);
    }
}
