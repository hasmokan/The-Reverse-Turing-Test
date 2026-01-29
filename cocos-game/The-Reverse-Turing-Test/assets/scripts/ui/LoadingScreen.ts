import { _decorator, Component, Node, Label, ProgressBar, tween, Vec3, UIOpacity } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 加载屏幕组件
 * 显示资源加载进度
 */
@ccclass('LoadingScreen')
export class LoadingScreen extends Component {
    @property(ProgressBar)
    progressBar: ProgressBar = null!;

    @property(Label)
    percentLabel: Label = null!;

    @property(Label)
    tipLabel: Label = null!;

    @property(Node)
    loadingNode: Node = null!;

    private _loadingComplete = false;

    onLoad() {
        // 确保加载屏幕初始可见
        this.node.active = true;

        // 初始化进度
        if (this.progressBar) {
            this.progressBar.progress = 0;
        }
        if (this.percentLabel) {
            this.percentLabel.string = '0%';
        }
        if (this.tipLabel) {
            this.tipLabel.string = '正在加载资源...';
        }

        // 启动加载图标旋转动画
        this.startLoadingAnimation();
    }

    /**
     * 更新加载进度
     * @param loaded 已加载数量
     * @param total 总数量
     * @param currentItem 当前加载项
     */
    public updateProgress(loaded: number, total: number, currentItem: string = ''): void {
        if (this._loadingComplete) return;

        const progress = total > 0 ? loaded / total : 0;
        const percent = Math.floor(progress * 100);

        // 更新进度条
        if (this.progressBar) {
            this.progressBar.progress = progress;
        }

        // 更新百分比文本
        if (this.percentLabel) {
            this.percentLabel.string = `${percent}%`;
        }

        // 更新提示文本
        if (this.tipLabel) {
            if (currentItem) {
                this.tipLabel.string = `正在加载: ${currentItem}`;
            } else {
                this.tipLabel.string = `加载中... ${loaded}/${total}`;
            }
        }
    }

    /**
     * 设置加载完成
     * @param onComplete 完成回调
     */
    public setComplete(onComplete?: () => void): void {
        if (this._loadingComplete) return;

        this._loadingComplete = true;

        // 更新到 100%
        this.updateProgress(1, 1);

        // 更新提示文本
        if (this.tipLabel) {
            this.tipLabel.string = '加载完成！';
        }

        // 延迟淡出
        this.scheduleOnce(() => {
            this.fadeOut(() => {
                if (onComplete) {
                    onComplete();
                }
            });
        }, 0.5);
    }

    /**
     * 设置加载失败
     * @param errorMessage 错误信息
     */
    public setError(errorMessage: string): void {
        if (this.tipLabel) {
            this.tipLabel.string = `加载失败: ${errorMessage}`;
        }

        // 停止加载动画
        this.stopLoadingAnimation();
    }

    /**
     * 启动加载动画（旋转）
     */
    private startLoadingAnimation(): void {
        if (!this.loadingNode) return;

        // 持续旋转动画
        tween(this.loadingNode)
            .repeatForever(
                tween()
                    .to(1, { angle: -360 }, { easing: 'linear' })
            )
            .start();
    }

    /**
     * 停止加载动画
     */
    private stopLoadingAnimation(): void {
        if (!this.loadingNode) return;

        tween(this.loadingNode).stop();
    }

    /**
     * 淡出加载屏幕
     */
    private fadeOut(onComplete?: () => void): void {
        const opacity = this.node.getComponent(UIOpacity);
        if (!opacity) {
            // 如果没有 UIOpacity 组件，直接隐藏
            this.node.active = false;
            if (onComplete) {
                onComplete();
            }
            return;
        }

        // 淡出动画
        tween(opacity)
            .to(0.5, { opacity: 0 })
            .call(() => {
                this.node.active = false;
                if (onComplete) {
                    onComplete();
                }
            })
            .start();
    }

    /**
     * 显示加载屏幕
     */
    public show(): void {
        this._loadingComplete = false;
        this.node.active = true;

        const opacity = this.node.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = 255;
        }

        // 重置进度
        if (this.progressBar) {
            this.progressBar.progress = 0;
        }
        if (this.percentLabel) {
            this.percentLabel.string = '0%';
        }
        if (this.tipLabel) {
            this.tipLabel.string = '正在加载资源...';
        }

        // 启动加载动画
        this.startLoadingAnimation();
    }

    /**
     * 隐藏加载屏幕
     */
    public hide(immediate: boolean = false): void {
        if (immediate) {
            this.node.active = false;
        } else {
            this.fadeOut();
        }
    }

    onDestroy(): void {
        this.stopLoadingAnimation();
    }
}
