import { _decorator, Component, Node, Button } from 'cc';
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
        // 绑定按钮点击事件
        if (this.singlePlayerButton) {
            this.singlePlayerButton.node.on(Button.EventType.CLICK, this.onSinglePlayerClick, this);
        }

        if (this.multiPlayerButton) {
            this.multiPlayerButton.node.on(Button.EventType.CLICK, this.onMultiPlayerClick, this);
        }

        if (this.rankingButton) {
            this.rankingButton.node.on(Button.EventType.CLICK, this.onRankingClick, this);
        }

        if (this.profileButton) {
            this.profileButton.node.on(Button.EventType.CLICK, this.onProfileClick, this);
        }
    }

    /**
     * 点击单人游戏
     */
    private onSinglePlayerClick() {
        console.log('点击单人游戏');

        // 使用淡入淡出效果切换到单人游戏场景
        if (SceneTransition.instance) {
            SceneTransition.instance.loadScene('MultiPlayerScene', TransitionType.FADE, 0.8);
        }
    }

    /**
     * 点击深海鱼缸（多人）
     */
    private onMultiPlayerClick() {
        console.log('点击深海鱼缸（多人）');

        // 使用从左滑入效果
        if (SceneTransition.instance) {
            SceneTransition.instance.loadScene('MultiPlayerScene', TransitionType.SLIDE_LEFT, 0.8);
        }
    }

    /**
     * 点击排行榜
     */
    private onRankingClick() {
        console.log('点击排行榜');

        // 使用缩放效果
        if (SceneTransition.instance) {
            SceneTransition.instance.loadScene('RankingScene', TransitionType.ZOOM, 0.8);
        }
    }

    /**
     * 点击个人中心
     */
    private onProfileClick() {
        console.log('点击个人中心');

        // 使用从右滑入效果
        if (SceneTransition.instance) {
            SceneTransition.instance.loadScene('ProfileScene', TransitionType.SLIDE_RIGHT, 0.8);
        }
    }

    onDestroy() {
        // 移除事件监听（需要检查组件和节点是否有效）
        if (this.singlePlayerButton && this.singlePlayerButton.isValid && this.singlePlayerButton.node) {
            this.singlePlayerButton.node.off(Button.EventType.CLICK, this.onSinglePlayerClick, this);
        }
        if (this.multiPlayerButton && this.multiPlayerButton.isValid && this.multiPlayerButton.node) {
            this.multiPlayerButton.node.off(Button.EventType.CLICK, this.onMultiPlayerClick, this);
        }
        if (this.rankingButton && this.rankingButton.isValid && this.rankingButton.node) {
            this.rankingButton.node.off(Button.EventType.CLICK, this.onRankingClick, this);
        }
        if (this.profileButton && this.profileButton.isValid && this.profileButton.node) {
            this.profileButton.node.off(Button.EventType.CLICK, this.onProfileClick, this);
        }
    }
}
