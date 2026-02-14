import { _decorator, Component, Camera, view, screen } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 摄像头适配器
 * 自动调整摄像头参数以适配不同手机屏幕
 */
@ccclass('CameraAdapter')
export class CameraAdapter extends Component {

    @property({ tooltip: '设计稿宽度' })
    designWidth: number = 750;

    @property({ tooltip: '设计稿高度' })
    designHeight: number = 1334;

    @property({ tooltip: '是否自动适配' })
    autoAdapt: boolean = true;

    private _camera: Camera = null!;

    onLoad() {
        this._camera = this.getComponent(Camera)!;
        if (!this._camera) {
            console.error('[CameraAdapter] Camera component not found!');
            return;
        }
    }

    start() {
        if (this.autoAdapt) {
            this.adaptCamera();
        }
    }

    onEnable() {
        view.on('canvas-resize', this.onCanvasResize, this);
    }

    onDisable() {
        view.off('canvas-resize', this.onCanvasResize, this);
    }

    /**
     * 适配摄像头
     */
    public adaptCamera() {
        if (!this._camera) return;

        const visibleSize = view.getVisibleSize();
        const designSize = view.getDesignResolutionSize();

        // 计算正交高度
        // 对于 Fit Height 模式，orthoHeight = 设计高度 / 2
        // 对于 Fit Width 模式，需要根据实际宽高比计算
        const orthoHeight = designSize.height / 2;

        this._camera.orthoHeight = orthoHeight;

        // 摄像头位置居中（相对于 Canvas 中心）
        this.node.setPosition(0, 0, 1000);

        console.log(`[CameraAdapter] 摄像头适配完成:
            可见区域: ${visibleSize.width} x ${visibleSize.height}
            设计分辨率: ${designSize.width} x ${designSize.height}
            Ortho Height: ${orthoHeight}
            摄像头位置: (0, 0, 1000)`);
    }

    private onCanvasResize() {
        if (this.autoAdapt) {
            this.adaptCamera();
        }
    }
}
