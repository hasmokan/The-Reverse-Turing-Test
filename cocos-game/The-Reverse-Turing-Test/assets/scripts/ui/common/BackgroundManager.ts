import { _decorator, Component, Sprite, SpriteFrame, UITransform, view, Size, screen, Enum, assetManager, ImageAsset, Texture2D, log as ccLog, error as ccError } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 适配模式枚举
 */
enum FitMode {
    /** 覆盖模式：确保背景完全覆盖屏幕，可能裁切 */
    COVER = 0,
    /** 包含模式：确保背景完全显示，可能有黑边 */
    CONTAIN = 1,
    /** 拉伸模式：直接拉伸填满，可能变形 */
    STRETCH = 2,
    /** 宽度优先：宽度完整显示；若高度不足则仅纵向拉伸补齐 */
    WIDTH_PRIORITY_STRETCH_HEIGHT = 3,
}
// 注册枚举，使编辑器能正确识别
Enum(FitMode);

/**
 * 背景管理器
 * 用于设置和管理游戏背景图，支持多种手机屏幕适配模式
 */
@ccclass('BackgroundManager')
export class BackgroundManager extends Component {

    @property({ tooltip: '远程背景图 URL（优先于本地 backgroundImage）' })
    remoteUrl: string = '';

    @property(SpriteFrame)
    backgroundImage: SpriteFrame = null!;

    @property({ tooltip: '是否自动适配屏幕大小' })
    autoFitScreen: boolean = true;

    @property({
        type: FitMode,
        tooltip: `适配模式:
COVER - 覆盖屏幕
CONTAIN - 完整显示
STRETCH - 拉伸填满
WIDTH_PRIORITY_STRETCH_HEIGHT - 宽不裁切，高度不足自动拉伸`
    })
    fitMode: FitMode = FitMode.WIDTH_PRIORITY_STRETCH_HEIGHT;

    @property({ tooltip: '设计稿宽度 (用于计算适配比例)' })
    designWidth: number = 750;

    @property({ tooltip: '设计稿高度 (用于计算适配比例)' })
    designHeight: number = 1334;

    private _sprite: Sprite = null!;
    private _uiTransform: UITransform = null!;

    onLoad() {
        this.setupBackground();
    }

    async start() {
        // 优先从远程 URL 加载背景
        if (this.remoteUrl) {
            await this.loadRemoteBackground(this.remoteUrl);
        }

        if (this.autoFitScreen) {
            this.fitToScreen();
        }
    }

    /**
     * 从远程 URL 加载背景图
     */
    private loadRemoteBackground(url: string): Promise<void> {
        return new Promise((resolve) => {
            const cleanUrl = url.split('?')[0];
            const ext = cleanUrl.match(/\.(png|jpg|jpeg|webp)$/i)?.[0] || '.png';

            assetManager.loadRemote<ImageAsset>(url, { ext }, (err, imageAsset) => {
                if (err) {
                    ccError('[BackgroundManager] 远程背景加载失败:', err);
                    resolve();
                    return;
                }

                const texture = new Texture2D();
                texture.image = imageAsset;
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;

                this.changeBackground(spriteFrame);
                ccLog('[BackgroundManager] 远程背景已加载');
                resolve();
            });
        });
    }

    /**
     * 初始化背景组件
     */
    private setupBackground() {
        // 确保有 Sprite 组件
        this._sprite = this.getComponent(Sprite) || this.addComponent(Sprite);
        this._uiTransform = this.getComponent(UITransform) || this.addComponent(UITransform);

        // 设置背景图
        if (this.backgroundImage) {
            this._sprite.spriteFrame = this.backgroundImage;
        }

        // 确保背景在最底层
        this.node.setSiblingIndex(0);
    }

    /**
     * 适配屏幕大小
     * 根据不同的适配模式调整背景尺寸
     */
    public fitToScreen() {
        const visibleSize = view.getVisibleSize();
        const designSize = view.getDesignResolutionSize();

        if (!this.backgroundImage) {
            this._uiTransform.setContentSize(visibleSize.width, visibleSize.height);
            return;
        }

        const imgSize = this.backgroundImage.originalSize;

        switch (this.fitMode) {
            case FitMode.COVER:
                this.applyCoverMode(visibleSize, imgSize);
                break;
            case FitMode.CONTAIN:
                this.applyContainMode(visibleSize, imgSize);
                break;
            case FitMode.STRETCH:
                this._uiTransform.setContentSize(visibleSize.width, visibleSize.height);
                break;
            case FitMode.WIDTH_PRIORITY_STRETCH_HEIGHT:
                this.applyWidthPriorityStretchHeightMode(visibleSize, imgSize);
                break;
        }

        this.node.setPosition(0, 0, 0);

        ccLog(`[BackgroundManager] 屏幕适配完成:
            可见区域: ${visibleSize.width} x ${visibleSize.height}
            设计分辨率: ${designSize.width} x ${designSize.height}
            背景原始尺寸: ${imgSize.width} x ${imgSize.height}
            适配后尺寸: ${this._uiTransform.contentSize.width} x ${this._uiTransform.contentSize.height}
            适配模式: ${FitMode[this.fitMode]}`);
    }

    /**
     * 覆盖模式：确保背景完全覆盖屏幕
     */
    private applyCoverMode(visibleSize: Size, imgSize: Size) {
        const scaleX = visibleSize.width / imgSize.width;
        const scaleY = visibleSize.height / imgSize.height;
        const scale = Math.max(scaleX, scaleY);

        this._uiTransform.setContentSize(
            imgSize.width * scale,
            imgSize.height * scale
        );
    }

    /**
     * 包含模式：确保背景完全显示
     */
    private applyContainMode(visibleSize: Size, imgSize: Size) {
        const scaleX = visibleSize.width / imgSize.width;
        const scaleY = visibleSize.height / imgSize.height;
        const scale = Math.min(scaleX, scaleY);

        this._uiTransform.setContentSize(
            imgSize.width * scale,
            imgSize.height * scale
        );
    }

    /**
     * 宽度优先 + 高度兜底拉伸
     */
    private applyWidthPriorityStretchHeightMode(visibleSize: Size, imgSize: Size) {
        const widthScale = visibleSize.width / imgSize.width;
        const fittedHeight = imgSize.height * widthScale;
        const finalHeight = Math.max(fittedHeight, visibleSize.height);
        this._uiTransform.setContentSize(visibleSize.width, finalHeight);
    }

    /**
     * 获取当前屏幕的安全区域信息
     */
    public getSafeAreaInfo(): { top: number; bottom: number; left: number; right: number } {
        const frameSize = screen.windowSize;

        const safeArea = {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        };

        const aspectRatio = frameSize.height / frameSize.width;
        if (aspectRatio > 2.0) {
            safeArea.top = 44;
            safeArea.bottom = 34;
        }

        return safeArea;
    }

    /**
     * 动态更换背景图
     */
    public changeBackground(spriteFrame: SpriteFrame) {
        this.backgroundImage = spriteFrame;
        if (this._sprite) {
            this._sprite.spriteFrame = spriteFrame;
        }
        if (this.autoFitScreen) {
            this.fitToScreen();
        }
    }

    onEnable() {
        view.on('canvas-resize', this.onCanvasResize, this);
    }

    onDisable() {
        view.off('canvas-resize', this.onCanvasResize, this);
    }

    private onCanvasResize() {
        if (this.autoFitScreen) {
            this.fitToScreen();
        }
    }
}
