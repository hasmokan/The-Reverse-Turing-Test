import { _decorator, Component, Node, Sprite, director, Color, find } from 'cc';
import { ResourceLoader } from './ResourceLoader';
import { LoadingScreen } from '../ui/common/LoadingScreen';
import { ResourceConfig } from './ResourceConfig';
import { BackgroundManager } from '../ui/common/BackgroundManager';

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
        console.log('[GameBootstrap] 游戏启动中...');

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
                console.warn('[GameBootstrap] 加载兜底触发，强制进入主菜单');
                this.onLoadComplete();
            }
        }, 20);

        try {
            // 预加载资源
            await this.preloadResources();
        } catch (error) {
            console.error('[GameBootstrap] 启动阶段异常:', error);
        }

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

            // 应用所有远程图片
            this.applyRemoteImages();

        } catch (error) {
            console.error('[GameBootstrap] 资源加载异常:', error);
            if (this.loadingScreen) {
                this.loadingScreen.setError('资源加载失败');
            }
        }
    }

    /**
     * 应用所有远程图片到对应的场景节点
     */
    private applyRemoteImages(): void {
        if (!this.resourceLoader) return;

        const canvas = find('Canvas');
        if (!canvas) {
            console.warn('[GameBootstrap] 未找到 Canvas 节点');
            return;
        }

        const mapping = ResourceConfig.NODE_MAPPING;
        let applied = 0;

        for (const [key, nodeName] of Object.entries(mapping)) {
            const spriteFrame = this.resourceLoader.getSpriteFrame(key);
            if (!spriteFrame) {
                console.warn(`[GameBootstrap] 未找到远程资源: ${key}`);
                continue;
            }

            const targetNode = this.findNodeByName(canvas, nodeName);
            if (!targetNode) {
                console.warn(`[GameBootstrap] 未找到节点: ${nodeName}`);
                continue;
            }

            const sprite = targetNode.getComponent(Sprite);
            if (!sprite) {
                console.warn(`[GameBootstrap] 节点 ${nodeName} 没有 Sprite 组件`);
                continue;
            }

            // 节点挂了 BackgroundManager 时，统一走 changeBackground 触发重适配。
            const backgroundManager = targetNode.getComponent(BackgroundManager);
            if (backgroundManager) {
                backgroundManager.changeBackground(spriteFrame);
            } else {
                sprite.spriteFrame = spriteFrame;
            }

            sprite.color = new Color(255, 255, 255, 255);
            applied++;
        }

        console.log(`[GameBootstrap] 已应用 ${applied}/${Object.keys(mapping).length} 个远程图片`);
    }

    /**
     * 递归查找子节点
     */
    private findNodeByName(root: Node, name: string): Node | null {
        for (const child of root.children) {
            if (child.name === name) return child;
            const found = this.findNodeByName(child, name);
            if (found) return found;
        }
        return null;
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
