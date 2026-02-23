import { _decorator, Component, Node, Sprite, find, log as ccLog, warn as ccWarn, error as ccError } from 'cc';
import { ResourceLoader } from './ResourceLoader';
import { LoadingScreen } from '../ui/common/LoadingScreen';

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
    private _hasCompleted = false;

    async start() {
        ccLog('[GameBootstrap] 游戏启动中...');

        // 隐藏主菜单，显示加载屏幕
        if (this.mainMenuNode) {
            this.mainMenuNode.active = false;
        }

        if (this.loadingScreen) {
            this.loadingScreen.show();
        }

        // 启动兜底超时，防止资源层异常导致一直卡在加载页
        this.scheduleOnce(() => {
            if (!this._hasCompleted) {
                ccWarn('[GameBootstrap] 加载兜底触发，强制进入主菜单');
                this.onLoadComplete();
            }
        }, 20);

        try {
            // 预加载资源
            await this.preloadResources();
        } catch (error) {
            ccError('[GameBootstrap] 启动阶段异常:', error);
        }

        // 加载完成
        this.onLoadComplete();
    }

    /**
     * 预加载资源
     */
    private async preloadResources(): Promise<void> {
        const loader = (this.resourceLoader && this.resourceLoader.isValid)
            ? this.resourceLoader
            : ResourceLoader.instance;

        if (!loader) {
            ccError('[GameBootstrap] ResourceLoader 未找到');
            return;
        }
        this.resourceLoader = loader;

        ccLog('[GameBootstrap] 开始预加载资源...');

        try {
            const result = await loader.preloadResources(
                undefined, // 主包资源
                (loaded, total, currentItem) => {
                    // 更新进度条
                    if (this.loadingScreen) {
                        this.loadingScreen.updateProgress(loaded, total, currentItem);
                    }
                }
            );

            ccLog(`[GameBootstrap] 资源加载完成: 成功 ${result.loaded}, 失败 ${result.failed}`);

            // 如果有加载失败的资源，打印错误信息
            if (result.errors.length > 0) {
                ccWarn('[GameBootstrap] 加载失败的资源:', result.errors);
            }

            // 应用所有远程图片
            this.applyRemoteImages();

        } catch (error) {
            ccError('[GameBootstrap] 资源加载异常:', error);
            if (this.loadingScreen) {
                this.loadingScreen.setError('资源加载失败');
            }
        }
    }

    /**
     * 应用所有远程图片到对应的场景节点
     */
    private applyRemoteImages(): void {
        const loader = (this.resourceLoader && this.resourceLoader.isValid)
            ? this.resourceLoader
            : ResourceLoader.instance;
        if (!loader) return;

        const canvas = find('Canvas');
        if (!canvas) {
            ccWarn('[GameBootstrap] 未找到 Canvas 节点');
            return;
        }

        const { applied, total } = loader.applyMappedSpriteFrames(canvas);
        ccLog(`[GameBootstrap] 已应用 ${applied}/${total} 个远程图片`);
    }

    /**
     * 加载完成回调
     */
    private onLoadComplete(): void {
        if (this._hasCompleted) {
            return;
        }
        this._hasCompleted = true;
        this._isReady = true;

        ccLog('[GameBootstrap] 所有资源加载完成');

        // 隐藏加载屏幕
        if (this.loadingScreen) {
            this.loadingScreen.setComplete(() => {
                // 显示主菜单
                if (this.mainMenuNode) {
                    this.mainMenuNode.active = true;
                }

                ccLog('[GameBootstrap] 游戏已准备就绪');
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
