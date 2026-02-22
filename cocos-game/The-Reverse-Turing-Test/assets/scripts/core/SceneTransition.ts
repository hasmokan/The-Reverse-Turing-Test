import { _decorator, Component, director, Node, Sprite, Color, tween, Vec3, UIOpacity, macro, BlockInputEvents, assetManager, log as ccLog, warn as ccWarn, error as ccError } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 场景转场动画类型
 */
export enum TransitionType {
    FADE = 'fade',              // 淡入淡出
    SLIDE_LEFT = 'slide_left',  // 从右向左滑动
    SLIDE_RIGHT = 'slide_right', // 从左向右滑动
    ZOOM = 'zoom',              // 缩放
    CIRCLE = 'circle'           // 圆形扩散
}

/**
 * 场景转场管理器
 * 提供多种过场动画效果
 */
@ccclass('SceneTransition')
export class SceneTransition extends Component {
    @property(Node)
    transitionLayer: Node = null!;

    @property(Sprite)
    transitionSprite: Sprite = null!;

    private static _instance: SceneTransition = null!;

    public static get instance(): SceneTransition {
        return this._instance;
    }

    onLoad() {
        SceneTransition._instance = this;

        // 重要：将 TransitionLayer 设为当前节点的子节点并持久化
        // 或者直接持久化 TransitionLayer
        if (this.transitionLayer) {
            // 如果 transitionLayer 不是当前节点的子节点，需要将其设为持久化
            if (this.transitionLayer.parent !== this.node) {
                director.addPersistRootNode(this.transitionLayer);
            }
            this.transitionLayer.active = false;
        }

        // 持久化当前节点，在切换场景时不销毁
        director.addPersistRootNode(this.node);
    }

    /**
     * 切换到指定场景，带过场动画
     * @param sceneName 场景名称
     * @param transitionType 过场动画类型
     * @param duration 动画持续时间
     * @param bundleName 分包名称（可选，如果场景在分包中）
     */
    public loadScene(sceneName: string, transitionType: TransitionType = TransitionType.FADE, duration: number = 0.5, bundleName?: string) {
        // 检查 transitionLayer 是否有效
        if (!this.transitionLayer || !this.transitionLayer.isValid) {
            ccError('TransitionLayer 无效，直接切换场景');
            this.loadSceneInternal(sceneName, bundleName);
            return;
        }

        // 显示转场层并阻止输入
        this.transitionLayer.active = true;
        const blockInput = this.transitionLayer.getComponent(BlockInputEvents);
        if (blockInput) {
            blockInput.enabled = true;
        }

        // 执行过场动画
        this.playTransition(transitionType, duration, () => {
            // 动画中间切换场景
            this.loadSceneInternal(sceneName, bundleName, () => {
                // 场景加载完成后淡出转场层
                this.fadeOut(duration, () => {
                    if (this.transitionLayer && this.transitionLayer.isValid) {
                        this.transitionLayer.active = false;
                    }
                    if (blockInput && blockInput.isValid) {
                        blockInput.enabled = false;
                    }
                });
            });
        });
    }

    /**
     * 内部场景加载方法，支持分包
     */
    private loadSceneInternal(sceneName: string, bundleName?: string, onComplete?: () => void) {
        if (bundleName) {
            // 场景在分包中，先加载分包
            ccLog(`加载分包: ${bundleName}`);
            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err) {
                    ccError(`分包 ${bundleName} 加载失败:`, err);
                    // 降级：尝试直接加载场景
                    director.loadScene(sceneName, onComplete);
                    return;
                }

                ccLog(`分包 ${bundleName} 加载成功，加载场景: ${sceneName}`);
                director.loadScene(sceneName, onComplete);
            });
        } else {
            // 主包场景，直接加载
            director.loadScene(sceneName, onComplete);
        }
    }

    /**
     * 播放过场动画
     */
    private playTransition(type: TransitionType, duration: number, midCallback: () => void) {
        const opacity = this.transitionLayer.getComponent(UIOpacity);
        if (!opacity) return;

        switch (type) {
            case TransitionType.FADE:
                this.fadeIn(duration, midCallback);
                break;
            case TransitionType.SLIDE_LEFT:
                this.slideIn(duration, true, midCallback);
                break;
            case TransitionType.SLIDE_RIGHT:
                this.slideIn(duration, false, midCallback);
                break;
            case TransitionType.ZOOM:
                this.zoomIn(duration, midCallback);
                break;
            default:
                this.fadeIn(duration, midCallback);
        }
    }

    /**
     * 淡入效果
     */
    private fadeIn(duration: number, callback: () => void) {
        const opacity = this.transitionLayer.getComponent(UIOpacity);
        if (!opacity) return;

        opacity.opacity = 0;

        tween(opacity)
            .to(duration / 2, { opacity: 255 })
            .call(() => {
                callback();
            })
            .start();
    }

    /**
     * 淡出效果
     */
    private fadeOut(duration: number, callback: () => void) {
        // 检查 transitionLayer 是否有效
        if (!this.transitionLayer || !this.transitionLayer.isValid) {
            ccWarn('TransitionLayer 无效，跳过淡出动画');
            callback();
            return;
        }

        const opacity = this.transitionLayer.getComponent(UIOpacity);
        if (!opacity) {
            callback();
            return;
        }

        tween(opacity)
            .to(duration / 2, { opacity: 0 })
            .call(() => {
                callback();
            })
            .start();
    }

    /**
     * 滑动进入效果
     */
    private slideIn(duration: number, fromRight: boolean, callback: () => void) {
        const opacity = this.transitionLayer.getComponent(UIOpacity);
        if (!opacity) return;

        opacity.opacity = 255;
        const startX = fromRight ? 1920 : -1920;
        this.transitionLayer.setPosition(startX, 0, 0);

        tween(this.transitionLayer)
            .to(duration / 2, { position: new Vec3(0, 0, 0) })
            .call(() => {
                callback();
            })
            .start();
    }

    /**
     * 缩放进入效果
     */
    private zoomIn(duration: number, callback: () => void) {
        const opacity = this.transitionLayer.getComponent(UIOpacity);
        if (!opacity) return;

        opacity.opacity = 255;
        this.transitionLayer.setScale(0, 0, 1);

        tween(this.transitionLayer)
            .to(duration / 2, { scale: new Vec3(10, 10, 1) }, {
                easing: 'backIn'
            })
            .call(() => {
                callback();
            })
            .start();
    }
}
