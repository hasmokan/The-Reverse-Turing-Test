import { _decorator, Component, Node, Graphics, EventTouch, Input, input, UITransform, Vec2, Vec3, Camera, Color, Button, RenderTexture, SpriteFrame, Sprite } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 画板组件
 * 支持触摸绘画，并可以将绘制内容转换为纹理
 */
@ccclass('DrawingBoard')
export class DrawingBoard extends Component {
    @property(Node)
    drawingCanvas: Node = null!;

    @property(Graphics)
    graphics: Graphics = null!;

    @property(Button)
    clearButton: Button = null!;

    @property(Button)
    submitButton: Button = null!;

    @property(Camera)
    camera: Camera = null!;

    @property({ type: Number })
    brushSize: number = 5;

    @property({ type: Color })
    brushColor: Color = new Color(0, 0, 0, 255);

    private isDrawing: boolean = false;
    private lastPoint: Vec2 = new Vec2();
    private renderTexture: RenderTexture | null = null;

    onLoad() {
        // 初始化 Graphics
        if (!this.graphics && this.drawingCanvas) {
            this.graphics = this.drawingCanvas.getComponent(Graphics) || this.drawingCanvas.addComponent(Graphics);
        }

        // 设置画笔
        if (this.graphics) {
            this.graphics.lineWidth = this.brushSize;
            this.graphics.strokeColor = this.brushColor;
            this.graphics.fillColor = Color.WHITE;

            // 先填充白色背景
            const transform = this.drawingCanvas.getComponent(UITransform);
            if (transform) {
                const width = transform.width;
                const height = transform.height;
                this.graphics.rect(-width / 2, -height / 2, width, height);
                this.graphics.fill();
            }
        }

        // 绑定触摸事件
        this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        // 绑定按钮事件
        if (this.clearButton) {
            this.clearButton.node.on(Button.EventType.CLICK, this.clearCanvas, this);
        }

        if (this.submitButton) {
            this.submitButton.node.on(Button.EventType.CLICK, this.onSubmit, this);
        }
    }

    onDestroy() {
        // 移除事件监听
        this.node.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        if (this.clearButton && this.clearButton.node) {
            this.clearButton.node.off(Button.EventType.CLICK, this.clearCanvas, this);
        }

        if (this.submitButton && this.submitButton.node) {
            this.submitButton.node.off(Button.EventType.CLICK, this.onSubmit, this);
        }

        // 释放渲染纹理
        if (this.renderTexture) {
            this.renderTexture.destroy();
            this.renderTexture = null;
        }
    }

    private onTouchStart(event: EventTouch) {
        const touchPos = this.getTouchPosition(event);
        if (touchPos && this.graphics) {
            this.isDrawing = true;
            this.lastPoint.set(touchPos);

            // 开始绘制
            this.graphics.moveTo(touchPos.x, touchPos.y);
        }
    }

    private onTouchMove(event: EventTouch) {
        if (!this.isDrawing || !this.graphics) return;

        const touchPos = this.getTouchPosition(event);
        if (touchPos) {
            // 绘制线条
            this.graphics.lineTo(touchPos.x, touchPos.y);
            this.graphics.stroke();

            // 更新最后位置
            this.lastPoint.set(touchPos);
        }
    }

    private onTouchEnd(event: EventTouch) {
        this.isDrawing = false;
    }

    /**
     * 将触摸位置转换为画布本地坐标
     */
    private getTouchPosition(event: EventTouch): Vec2 | null {
        const uiTransform = this.drawingCanvas.getComponent(UITransform);
        if (!uiTransform) return null;

        const touchLocation = event.getUILocation();
        const localPos = uiTransform.convertToNodeSpaceAR(new Vec3(touchLocation.x, touchLocation.y, 0));

        return new Vec2(localPos.x, localPos.y);
    }

    /**
     * 清空画布
     */
    private clearCanvas() {
        if (this.graphics) {
            this.graphics.clear();

            // 重新填充白色背景
            const transform = this.drawingCanvas.getComponent(UITransform);
            if (transform) {
                const width = transform.width;
                const height = transform.height;
                this.graphics.fillColor = Color.WHITE;
                this.graphics.rect(-width / 2, -height / 2, width, height);
                this.graphics.fill();

                // 重置画笔颜色
                this.graphics.strokeColor = this.brushColor;
            }
        }
    }

    /**
     * 提交绘画，生成自定义鱼
     */
    private onSubmit() {
        console.log('提交绘画，生成自定义鱼');

        // 生成纹理
        const spriteFrame = this.captureSpriteFrame();
        if (spriteFrame) {
            // 触发事件，将纹理传递给鱼生成器
            this.node.emit('drawing-completed', spriteFrame);

            // 清空画布供下次使用
            this.clearCanvas();
        }
    }

    /**
     * 捕获画布内容为 SpriteFrame
     */
    public captureSpriteFrame(): SpriteFrame | null {
        try {
            const transform = this.drawingCanvas.getComponent(UITransform);
            if (!transform) return null;

            const width = Math.floor(transform.width);
            const height = Math.floor(transform.height);

            // 创建 RenderTexture
            if (!this.renderTexture) {
                this.renderTexture = new RenderTexture();
                this.renderTexture.reset({
                    width: width,
                    height: height,
                });
            }

            // 如果已有旧的相机，先恢复
            const originalTarget = this.camera ? this.camera.targetTexture : null;

            // 临时设置相机渲染到纹理
            if (this.camera) {
                this.camera.targetTexture = this.renderTexture;

                // 手动触发一次渲染
                this.camera.node.active = false;
                this.camera.node.active = true;

                // 恢复相机设置
                this.camera.targetTexture = originalTarget;
            }

            // 创建 SpriteFrame
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = this.renderTexture;

            console.log('成功捕获画布内容为纹理');
            return spriteFrame;

        } catch (error) {
            console.error('捕获画布内容失败:', error);
            return null;
        }
    }

    /**
     * 设置画笔大小
     */
    public setBrushSize(size: number) {
        this.brushSize = size;
        if (this.graphics) {
            this.graphics.lineWidth = size;
        }
    }

    /**
     * 设置画笔颜色
     */
    public setBrushColor(color: Color) {
        this.brushColor = color;
        if (this.graphics) {
            this.graphics.strokeColor = color;
        }
    }
}
