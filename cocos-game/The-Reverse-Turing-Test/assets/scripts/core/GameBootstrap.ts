import { _decorator, Component, Node, Sprite, director, Color } from 'cc';
import { ResourceLoader } from './ResourceLoader';
import { LoadingScreen } from '../ui/LoadingScreen';
import { ResourceConfig } from './ResourceConfig';

const { ccclass, property } = _decorator;

/**
 * 游戏启动器
 * 负责初始化和预加载资源
 */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
    @property(LoadingScreen)
    loadingScreen: LoadingScreen = null!;

    @property(ResourceLoader)
    resourceLoader: ResourceLoader = null!;

    @property(Node)
    mainMenuNode: Node = null!;

    @property(Sprite)
    backgroundSprite: Sprite = null!;

    private _isReady = false;

    async start() {
        console.log('[GameBootstrap] 游戏启动中...');

        // 隐藏主菜单，显示加载屏幕
        if (this.mainMenuNode) {
            this.mainMenuNode.active = false;
        }

        if (this.loadingScreen) {
            this.loadingScreen.show();
        }

        // 预加载资源
        await this.preloadResources();

        // 加载完成
        this.onLoadComplete();
    }

    /**
     * 预加载资源
     */
    private async preloadResources(): Promise<void> {
        if (!this.resourceLoader) {
            console.error('[GameBootstrap] ResourceLoader 未找到');
            return;
        }

        console.log('[GameBootstrap] 开始预加载资源...');

        try {
            const result = await this.resourceLoader.preloadResources(
                undefined, // 主包资源
                (loaded, total, currentItem) => {
                    // 更新进度条
                    if (this.loadingScreen) {
                        this.loadingScreen.updateProgress(loaded, total, currentItem);
                    }
                }
            );

            console.log(`[GameBootstrap] 资源加载完成: 成功 ${result.loaded}, 失败 ${result.failed}`);

            // 如果有加载失败的资源，打印错误信息
            if (result.errors.length > 0) {
                console.warn('[GameBootstrap] 加载失败的资源:', result.errors);
            }

            // 应用加载的背景图
            this.applyBackgroundImage();

        } catch (error) {
            console.error('[GameBootstrap] 资源加载异常:', error);
            if (this.loadingScreen) {
                this.loadingScreen.setError('资源加载失败');
            }
        }
    }

    /**
     * 应用背景图
     */
    private applyBackgroundImage(): void {
        if (!this.backgroundSprite || !this.resourceLoader) {
            return;
        }

        // 获取主背景图
        const spriteFrame = this.resourceLoader.getSpriteFrame('home_bg');
        if (spriteFrame) {
            this.backgroundSprite.spriteFrame = spriteFrame;
            // 修复：设置颜色为白色以正常显示图片（默认黑色会使图片不可见）
            this.backgroundSprite.color = new Color(255, 255, 255, 255);
            console.log('[GameBootstrap] 背景图已应用');
        } else {
            console.warn('[GameBootstrap] 未找到背景图: home_bg');
        }
    }

    /**
     * 加载完成回调
     */
    private onLoadComplete(): void {
        this._isReady = true;

        console.log('[GameBootstrap] 所有资源加载完成');

        // 隐藏加载屏幕
        if (this.loadingScreen) {
            this.loadingScreen.setComplete(() => {
                // 显示主菜单
                if (this.mainMenuNode) {
                    this.mainMenuNode.active = true;
                }

                console.log('[GameBootstrap] 游戏已准备就绪');
            });
        } else {
            // 如果没有加载屏幕，直接显示主菜单
            if (this.mainMenuNode) {
                this.mainMenuNode.active = true;
            }
        }
    }

    /**
     * 检查游戏是否已准备就绪
     */
    public isReady(): boolean {
        return this._isReady;
    }
}
