import { _decorator, Component, Camera, view, find, Canvas, screen, log as ccLog, warn as ccWarn, error as ccError } from 'cc';
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

    @property({ tooltip: '输出屏幕适配调试日志（临时）' })
    verboseAdaptationLog: boolean = true;

    private _camera: Camera = null!;
    private _adaptationPassCount: number = 0;

    onLoad() {
        this._camera = this.getComponent(Camera)!;
        if (!this._camera) {
            ccError('[CameraAdapter] Camera component not found!');
            return;
        }
        this.logViewportSnapshot('onLoad');
    }

    start() {
        if (!this.autoAdapt) return;

        this.logViewportSnapshot('start-before-pass');
        this.runAdaptationPass();
        // 首帧后补两次，避免设备在启动阶段上报尺寸抖动
        this.scheduleOnce(this.runDeferredAdaptationPass0, 0);
        this.scheduleOnce(this.runDeferredAdaptationPass1, 0.2);
        this.scheduleOnce(() => this.logViewportSnapshot('probe-0.5s'), 0.5);
        this.scheduleOnce(() => this.logViewportSnapshot('probe-1.0s'), 1.0);
    }

    onEnable() {
        view.on('canvas-resize', this.onCanvasResize, this);
        view.on('design-resolution-changed', this.onDesignResolutionChanged, this);
        this.logViewportSnapshot('onEnable');
    }

    onDisable() {
        view.off('canvas-resize', this.onCanvasResize, this);
        view.off('design-resolution-changed', this.onDesignResolutionChanged, this);
        this.unschedule(this.runAdaptationPass);
        this.unschedule(this.runDeferredAdaptationPass0);
        this.unschedule(this.runDeferredAdaptationPass1);
    }

    private runAdaptationPass() {
        this._adaptationPassCount += 1;
        this.logViewportSnapshot(`runAdaptationPass#${this._adaptationPassCount}-before`);
        this.applyCanvasPolicy();
        this.adaptCamera();
        this.logViewportSnapshot(`runAdaptationPass#${this._adaptationPassCount}-after`);
    }

    private runDeferredAdaptationPass0() {
        this.runAdaptationPass();
    }

    private runDeferredAdaptationPass1() {
        this.runAdaptationPass();
    }

    private logViewportSnapshot(reason: string) {
        if (!this.verboseAdaptationLog) return;

        const frame = screen.windowSize;
        const visible = view.getVisibleSize();
        const design = view.getDesignResolutionSize();
        ccLog(
            `[CameraAdapter] ${reason} frame=${frame.width}x${frame.height} ` +
            `visible=${visible.width}x${visible.height} design=${design.width}x${design.height} ` +
            `cameraOrtho=${this._camera?.orthoHeight ?? -1}`
        );
    }

    /**
     * 适配摄像头
     */
    public adaptCamera() {
        if (!this._camera) return;

        const visibleSize = view.getVisibleSize();
        const designSize = view.getDesignResolutionSize();

        // UI 正交相机应跟随当前可见高度，避免超高屏首帧看起来“未适配/被放大”
        const orthoHeight = visibleSize.height / 2;

        this._camera.orthoHeight = orthoHeight;

        // 摄像头位置居中（相对于 Canvas 中心）
        this.node.setPosition(0, 0, 1000);

        ccLog(`[CameraAdapter] 摄像头适配完成:
            可见区域: ${visibleSize.width} x ${visibleSize.height}
            设计分辨率: ${designSize.width} x ${designSize.height}
            Ortho Height: ${orthoHeight}
            摄像头位置: (0, 0, 1000)`);
    }

    private applyCanvasPolicy() {
        const canvasNode = find('Canvas');
        const canvas = canvasNode?.getComponent(Canvas);
        if (!canvas) {
            ccWarn('[CameraAdapter] Canvas not found, skip canvas policy');
            return;
        }

        const result = applyCanvasScaleMode(canvas, this.standardRatio, this.preferFitWidth);
        ccLog(`[CameraAdapter] Canvas policy applied: fitWidth=${result.fitWidth}, fitHeight=${result.fitHeight}, ratio=${result.currentRatio.toFixed(3)}`);
    }

    private onCanvasResize() {
        if (this.autoAdapt) {
            this.logViewportSnapshot('event:canvas-resize');
            this.runAdaptationPass();
        }
    }

    private onDesignResolutionChanged() {
        if (this.autoAdapt) {
            this.logViewportSnapshot('event:design-resolution-changed');
        }
    }
}
