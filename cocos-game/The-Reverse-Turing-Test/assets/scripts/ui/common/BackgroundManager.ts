import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, view, ResolutionPolicy, Size, Widget, screen, Enum, assetManager, ImageAsset, Texture2D } from 'cc';
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
        tooltip: '适配模式:\nCOVER - 覆盖屏幕(推荐)\nCONTAIN - 完整显示\nSTRETCH - 拉伸填满'
    })
    fitMode: FitMode = FitMode.COVER;

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
                    console.error('[BackgroundManager] 远程背景加载失败:', err);
                    resolve();
                    return;
                }

                const texture = new Texture2D();
                texture.image = imageAsset;
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;

                this.changeBackground(spriteFrame);
                console.log('[BackgroundManager] 远程背景已加载');
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
        // 获取可见区域大小
        const visibleSize = view.getVisibleSize();
        // 获取设计分辨率
        const designSize = view.getDesignResolutionSize();

        // 如果没有背景图，直接使用可见区域大小
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
        }

        // 确保背景居中
        this.node.setPosition(0, 0, 0);

        console.log(`[BackgroundManager] 屏幕适配完成:
            可见区域: ${visibleSize.width} x ${visibleSize.height}
            设计分辨率: ${designSize.width} x ${designSize.height}
            背景原始尺寸: ${imgSize.width} x ${imgSize.height}
            适配后尺寸: ${this._uiTransform.contentSize.width} x ${this._uiTransform.contentSize.height}
            适配模式: ${FitMode[this.fitMode]}`);
    }

    /**
     * 覆盖模式：确保背景完全覆盖屏幕
     * 背景会等比缩放，可能会裁切部分内容
     */
    private applyCoverMode(visibleSize: Size, imgSize: Size) {
        const scaleX = visibleSize.width / imgSize.width;
        const scaleY = visibleSize.height / imgSize.height;
        // 取较大值，确保完全覆盖
        const scale = Math.max(scaleX, scaleY);

        this._uiTransform.setContentSize(
            imgSize.width * scale,
            imgSize.height * scale
        );
    }

    /**
     * 包含模式：确保背景完全显示
     * 背景会等比缩放，可能会有黑边
     */
    private applyContainMode(visibleSize: Size, imgSize: Size) {
        const scaleX = visibleSize.width / imgSize.width;
        const scaleY = visibleSize.height / imgSize.height;
        // 取较小值，确保完全显示
        const scale = Math.min(scaleX, scaleY);

        this._uiTransform.setContentSize(
            imgSize.width * scale,
            imgSize.height * scale
        );
    }

    /**
     * 获取当前屏幕的安全区域信息
     * 用于处理刘海屏、挖孔屏等异形屏
     */
    public getSafeAreaInfo(): { top: number; bottom: number; left: number; right: number } {
        const visibleSize = view.getVisibleSize();
        const frameSize = screen.windowSize;

        // 计算安全区域边距（简化版本，实际需要根据平台API获取）
        const safeArea = {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        };

        // 对于竖屏游戏，主要考虑顶部和底部的安全区域
        // 这里提供一个通用的估算值，实际项目中应该使用平台API
        const aspectRatio = frameSize.height / frameSize.width;

        // 如果是超长屏（如 iPhone X 系列，比例 > 2.0）
        if (aspectRatio > 2.0) {
            safeArea.top = 44;    // 顶部刘海区域
            safeArea.bottom = 34; // 底部 Home 指示器区域
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

    /**
     * 监听屏幕尺寸变化
     */
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
