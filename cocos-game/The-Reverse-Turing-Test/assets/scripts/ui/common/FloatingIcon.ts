import { _decorator, Component, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 图标浮动动画组件
 * 实现随机的上下左右浮动效果，每个图标参数不同步
 */
@ccclass('FloatingIcon')
export class FloatingIcon extends Component {
    @property({ tooltip: '水平浮动幅度' })
    horizontalAmplitude: number = 10;

    @property({ tooltip: '垂直浮动幅度' })
    verticalAmplitude: number = 15;

    @property({ tooltip: '水平浮动速度' })
    horizontalSpeed: number = 1.0;

    @property({ tooltip: '垂直浮动速度' })
    verticalSpeed: number = 1.5;

    @property({ tooltip: '水平相位偏移（让图标不同步）' })
    horizontalPhaseOffset: number = 0;

    @property({ tooltip: '垂直相位偏移（让图标不同步）' })
    verticalPhaseOffset: number = 0;

    private _originalPosition: Vec3 = new Vec3();
    private _time: number = 0;

    onLoad() {
        // 保存初始位置
        this._originalPosition.set(this.node.position);
    }

    update(deltaTime: number) {
        this._time += deltaTime;

        // 使用正弦波创建平滑的浮动效果
        const offsetX = Math.sin(this._time * this.horizontalSpeed + this.horizontalPhaseOffset) * this.horizontalAmplitude;
        const offsetY = Math.cos(this._time * this.verticalSpeed + this.verticalPhaseOffset) * this.verticalAmplitude;

        // 应用浮动偏移
        this.node.setPosition(
            this._originalPosition.x + offsetX,
            this._originalPosition.y + offsetY,
            this._originalPosition.z
        );
    }
}
