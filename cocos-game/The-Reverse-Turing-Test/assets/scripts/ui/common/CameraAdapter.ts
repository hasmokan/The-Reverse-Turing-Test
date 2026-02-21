import { _decorator, Component, Camera, view, find, Canvas } from 'cc';
import { applyCanvasScaleMode } from './ScreenAdaptationPolicy';
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

    @property({ tooltip: '标准宽高比（用于可选分支策略）' })
    standardRatio: number = 9 / 16;

    @property({ tooltip: '是否始终宽度优先（当前项目建议开启）' })
    preferFitWidth: boolean = true;

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
            this.applyCanvasPolicy();
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

        // 正交相机高度跟随设计分辨率高度变化
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

    private applyCanvasPolicy() {
        const canvasNode = find('Canvas');
        const canvas = canvasNode?.getComponent(Canvas);
        if (!canvas) {
            console.warn('[CameraAdapter] Canvas not found, skip canvas policy');
            return;
        }

        const result = applyCanvasScaleMode(canvas, this.standardRatio, this.preferFitWidth);
        console.log(`[CameraAdapter] Canvas policy applied: fitWidth=${result.fitWidth}, fitHeight=${result.fitHeight}, ratio=${result.currentRatio.toFixed(3)}`);
    }

    private onCanvasResize() {
        if (this.autoAdapt) {
            this.applyCanvasPolicy();
            this.adaptCamera();
        }
    }
}
