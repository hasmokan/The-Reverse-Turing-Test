import { _decorator, Component, Node, Button, director, find, log as ccLog, warn as ccWarn, error as ccError } from 'cc';
import { SceneTransition, TransitionType } from '../../core/SceneTransition';
import { ResourceLoader } from '../../core/ResourceLoader';
import { LoadingScreen } from '../common/LoadingScreen';
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

    private _isPreparingScene = false;
    private static readonly MIN_PRELOAD_DELAY_MS = 350;

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
        void this.preloadThenLoadScene('MultiPlayerScene', TransitionType.FADE, 0.8);
    }

    /**
     * 点击深海鱼缸（多人）
     */
    private onMultiPlayerClick() {
        ccLog('点击深海鱼缸（多人）');
        void this.preloadThenLoadScene('MultiPlayerScene', TransitionType.SLIDE_LEFT, 0.8);
    }

    /**
     * 点击排行榜
     */
    private onRankingClick() {
        ccLog('点击排行榜');
        void this.preloadThenLoadScene('RankingScene', TransitionType.ZOOM, 0.8);
    }

    /**
     * 点击个人中心
     */
    private onProfileClick() {
        ccLog('点击个人中心（场景未开放，返回主菜单）');
        void this.preloadThenLoadScene('MainScene', TransitionType.SLIDE_RIGHT, 0.8);
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

    private setMenuInteractable(interactable: boolean): void {
        for (const button of [this.singlePlayerButton, this.multiPlayerButton, this.rankingButton, this.profileButton]) {
            if (button && button.isValid) {
                button.interactable = interactable;
            }
        }
    }

    private async waitMs(ms: number): Promise<void> {
        if (ms <= 0) return;
        await new Promise<void>((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    private resolveLoadingScreen(): LoadingScreen | null {
        const loadingNode = find('Canvas/LoadingScreen');
        if (!loadingNode || !loadingNode.isValid) {
            return null;
        }
        const loadingScreen = loadingNode.getComponent(LoadingScreen);
        return loadingScreen && loadingScreen.isValid ? loadingScreen : null;
    }

    private resolveResourceLoader(): ResourceLoader | null {
        const singleton = ResourceLoader.instance;
        if (singleton && singleton.isValid) {
            return singleton;
        }

        const bootstrapLoaderNode = find('Canvas/GameBootstrap/ResourceLoader');
        if (!bootstrapLoaderNode || !bootstrapLoaderNode.isValid) {
            return null;
        }
        const fallbackLoader = bootstrapLoaderNode.getComponent(ResourceLoader);
        return fallbackLoader && fallbackLoader.isValid ? fallbackLoader : null;
    }

    private async preloadThenLoadScene(sceneName: string, type: TransitionType, duration: number): Promise<void> {
        if (this._isPreparingScene) {
            return;
        }

        if (sceneName !== 'MultiPlayerScene') {
            this.loadSceneWithFallback(sceneName, type, duration);
            return;
        }

        this._isPreparingScene = true;
        this.setMenuInteractable(false);

        let triggered = false;
        const triggerLoad = (): void => {
            if (triggered) return;
            triggered = true;
            this.loadSceneWithFallback(sceneName, type, duration);
        };

        const loadingScreen = this.resolveLoadingScreen();
        loadingScreen?.show();

        const startedAt = Date.now();
        try {
            const loader = this.resolveResourceLoader();
            if (!loader) {
                ccWarn('[MenuButtonHandler] ResourceLoader 未找到，直接切场景');
                triggerLoad();
                return;
            }

            const result = await loader.preloadResources(undefined, (loaded, total, currentItem) => {
                loadingScreen?.updateProgress(loaded, total, currentItem);
            });

            if (!result.success) {
                ccWarn('[MenuButtonHandler] 远程资源预加载存在失败项:', result.errors);
            }

            const elapsed = Date.now() - startedAt;
            await this.waitMs(MenuButtonHandler.MIN_PRELOAD_DELAY_MS - elapsed);

            if (loadingScreen) {
                loadingScreen.setComplete(() => {
                    triggerLoad();
                });
            } else {
                triggerLoad();
            }
        } catch (error) {
            ccError('[MenuButtonHandler] 预加载远程资源失败，降级直接切场景:', error);
            triggerLoad();
        } finally {
            if (!triggered) {
                this._isPreparingScene = false;
                this.setMenuInteractable(true);
            }
        }
    }

    private loadSceneWithFallback(sceneName: string, type: TransitionType, duration: number): void {
        this._isPreparingScene = false;
        const transition = SceneTransition.instance;
        if (!transition || !transition.isValid) {
            ccError('SceneTransition 实例未找到，降级为直接切换场景');
            director.loadScene(sceneName);
            return;
        }

        transition.loadScene(sceneName, type, duration);
    }
}
