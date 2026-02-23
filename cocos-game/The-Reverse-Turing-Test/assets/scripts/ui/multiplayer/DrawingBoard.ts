import {
    _decorator,
    Component,
    Node,
    Graphics,
    EventTouch,
    Input,
    UITransform,
    Vec2,
    Vec3,
    Camera,
    Color,
    Button,
    RenderTexture,
    SpriteFrame,
    Sprite,
    Label,
    Widget,
    assetManager,
    ImageAsset,
    Texture2D,
    log as ccLog,
    error as ccError,
    warn as ccWarn,
} from 'cc';
const { ccclass, property } = _decorator;

const FRONTEND_BRUSH_COLOR_HEXES = ['#000000', '#FF2A2A', '#1F75FE', '#00CC44', '#FF9900'] as const;
const DRAW_ICON_URL = 'https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com/draw.png?imageSlim';
const ERASER_ICON_URL = 'https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com/eraser.png?imageSlim';
const SAVE_ICON_URL = 'https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com/save.png?imageSlim';

const ACTION_BUTTON_SIZE = 40;
const ACTION_BUTTON_SPACING = 20;
const MIN_BRUSH_SIZE = 2;
const MAX_BRUSH_SIZE = 24;
const MAX_STROKE_HISTORY = 120;
const CANVAS_BACKGROUND_COLOR = new Color(255, 255, 255, 255);

type BrushMode = 'draw' | 'eraser';

interface StrokeOperation {
    mode: BrushMode;
    color: Color;
    size: number;
    points: Vec2[];
}

/**
 * 画板组件
 * 支持触摸绘画，并可以将绘制内容转换为纹理
 */
@ccclass('DrawingBoard')
export class DrawingBoard extends Component {
    @property(Node)
    drawingCanvas: Node = null!;

    @property(Button)
    clearButton: Button = null!;

    @property(Button)
    submitButton: Button = null!;

    @property(Button)
    drawModeButton: Button = null!;

    @property(Button)
    eraserModeButton: Button = null!;

    @property([Button])
    colorButtons: Button[] = [];

    @property(Camera)
    camera: Camera = null!;

    @property({ type: Number })
    brushSize: number = 5;

    @property({ type: Color })
    brushColor: Color = new Color(0, 0, 0, 255);

    private graphics: Graphics | null = null;
    private isDrawing: boolean = false;
    private lastPoint: Vec2 = new Vec2();
    private mode: BrushMode = 'draw';
    private currentStroke: StrokeOperation | null = null;
    private strokeHistory: StrokeOperation[] = [];
    private isSubmitting: boolean = false;
    private lastSubmitSignature: string | null = null;
    private toolbarTextures: Texture2D[] = [];
    private toolbarSpriteFrames: SpriteFrame[] = [];

    private static readonly FRONTEND_BRUSH_COLORS: ReadonlyArray<Color> =
        FRONTEND_BRUSH_COLOR_HEXES.map((hex) => DrawingBoard.hexToColor(hex));

    private static hexToColor(hex: string): Color {
        const normalized = hex.replace('#', '').trim();
        if (normalized.length !== 6) {
            return new Color(0, 0, 0, 255);
        }

        const r = Number.parseInt(normalized.slice(0, 2), 16);
        const g = Number.parseInt(normalized.slice(2, 4), 16);
        const b = Number.parseInt(normalized.slice(4, 6), 16);
        return new Color(r, g, b, 255);
    }

    private static isSameColor(a: Color, b: Color): boolean {
        return a.r === b.r && a.g === b.g && a.b === b.b;
    }

    private static findAllowedBrushColor(color: Color): Color | null {
        return DrawingBoard.FRONTEND_BRUSH_COLORS.find((allowed) => DrawingBoard.isSameColor(allowed, color)) || null;
    }

    private normalizeBrushColor(color: Color): Color {
        const matched = DrawingBoard.findAllowedBrushColor(color);
        if (matched) {
            return matched.clone();
        }
        ccWarn('[DrawingBoard] brushColor 不在规定色板内，已回退到默认黑色');
        return DrawingBoard.FRONTEND_BRUSH_COLORS[0].clone();
    }

    onLoad() {
        this.ensureGraphicsTarget();
        this.ensureToolbars();

        this.brushSize = Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, this.brushSize));
        this.brushColor = this.normalizeBrushColor(this.brushColor);

        if (this.graphics) {
            this.graphics.lineCap = Graphics.LineCap.ROUND;
            this.graphics.lineJoin = Graphics.LineJoin.ROUND;
            this.graphics.lineWidth = this.brushSize;
            this.graphics.strokeColor = this.brushColor;
            this.graphics.fillColor = CANVAS_BACKGROUND_COLOR;
            this.fillCanvasBackground();
        }

        this.bindCanvasEvents();
        this.bindToolbarEvents();
        this.applyToolbarIcons();
        this.applyColorButtonStyles();
        this.refreshModeButtonState();
    }

    onDestroy() {
        this.unbindCanvasEvents();
        this.unbindToolbarEvents();
        this.toolbarSpriteFrames.forEach((frame) => {
            if (frame?.isValid) frame.destroy();
        });
        this.toolbarTextures.forEach((texture) => {
            if (texture?.isValid) texture.destroy();
        });
    }

    private ensureGraphicsTarget(): void {
        if (!this.drawingCanvas) {
            this.drawingCanvas = this.node.getChildByName('DrawCanvas') || this.node;
        }

        this.graphics = this.drawingCanvas.getComponent(Graphics);
        if (this.graphics) return;

        const hasConflictingRenderer = !!this.drawingCanvas.getComponent(Sprite) || !!this.drawingCanvas.getComponent(Label);
        if (hasConflictingRenderer) {
            let childCanvas = this.drawingCanvas.getChildByName('DrawCanvas');
            if (!childCanvas) {
                childCanvas = new Node('DrawCanvas');
                this.drawingCanvas.addChild(childCanvas);
                childCanvas.setPosition(0, 0, 0);

                const parentTransform = this.drawingCanvas.getComponent(UITransform);
                const childTransform = childCanvas.addComponent(UITransform);
                if (parentTransform) {
                    childTransform.setContentSize(parentTransform.contentSize);
                }
            }
            this.drawingCanvas = childCanvas;
        }

        this.graphics = this.drawingCanvas.getComponent(Graphics) || this.drawingCanvas.addComponent(Graphics);
    }

    private ensureToolbars(): void {
        const needsDynamicActionToolbar =
            !this.hasActionButtonReference(this.drawModeButton, 'DrawModeButton') ||
            !this.hasActionButtonReference(this.eraserModeButton, 'EraserModeButton') ||
            !this.hasActionButtonReference(this.submitButton, 'SubmitButton');

        const actionToolbar = needsDynamicActionToolbar
            ? this.ensureToolbarNode('DrawActionToolbar', 24)
            : null;
        this.drawModeButton = this.ensureActionButton(this.drawModeButton, 'DrawModeButton', actionToolbar, -ACTION_BUTTON_SIZE - ACTION_BUTTON_SPACING / 2);
        this.eraserModeButton = this.ensureActionButton(this.eraserModeButton, 'EraserModeButton', actionToolbar, 0);
        this.submitButton = this.ensureActionButton(this.submitButton, 'SubmitButton', actionToolbar, ACTION_BUTTON_SIZE + ACTION_BUTTON_SPACING / 2);

        const toolToolbar = this.ensureToolbarNode('DrawToolToolbar', 84);
        this.ensureColorButtons(toolToolbar);
    }

    private hasActionButtonReference(button: Button | null, name: string): boolean {
        if (button?.node?.isValid) {
            return true;
        }
        return !!this.findNodeInScope(name);
    }

    private findNodeInScope(name: string): Node | null {
        const roots: Node[] = [];
        if (this.node?.isValid) {
            roots.push(this.node);
        }
        if (this.node?.parent?.isValid) {
            roots.push(this.node.parent);
        }

        const visited = new Set<Node>();
        for (const root of roots) {
            const stack: Node[] = [root];
            while (stack.length > 0) {
                const current = stack.pop();
                if (!current || visited.has(current)) {
                    continue;
                }
                visited.add(current);
                if (current.name === name) {
                    return current;
                }
                stack.push(...current.children);
            }
        }

        return null;
    }

    private ensureToolbarNode(name: string, bottom: number): Node {
        let toolbar = this.findNodeInScope(name);
        if (!toolbar) {
            toolbar = new Node(name);
            this.node.addChild(toolbar);
        } else {
            return toolbar;
        }

        const transform = toolbar.getComponent(UITransform) || toolbar.addComponent(UITransform);
        transform.setContentSize(420, 44);

        const widget = toolbar.getComponent(Widget) || toolbar.addComponent(Widget);
        widget.isAlignBottom = true;
        widget.bottom = bottom;
        widget.isAlignHorizontalCenter = true;
        widget.horizontalCenter = 0;

        return toolbar;
    }

    private ensureActionButton(button: Button | null, name: string, parent: Node | null, x: number): Button {
        const existingNode = button?.node?.isValid ? button.node : this.findNodeInScope(name);
        const node = existingNode || new Node(name);
        const isNewNode = !existingNode;

        if (isNewNode) {
            (parent || this.node).addChild(node);
            node.setPosition(x, 0, 0);
        }
        node.getComponent(UITransform) || node.addComponent(UITransform);

        const sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
        if (isNewNode) {
            sprite.color = Color.WHITE;
        }

        const ensuredButton = node.getComponent(Button) || node.addComponent(Button);
        return ensuredButton;
    }

    private ensureColorButtons(parent: Node): void {
        if (this.colorButtons.length > 0) {
            this.colorButtons = this.colorButtons.filter((btn) => !!btn?.node?.isValid);
        }

        if (this.colorButtons.length === FRONTEND_BRUSH_COLOR_HEXES.length) {
            return;
        }

        const buttons: Button[] = [];
        FRONTEND_BRUSH_COLOR_HEXES.forEach((hex, index) => {
            const nodeName = `ColorButton-${index}`;
            const existing = parent.getChildByName(nodeName);
            const node = existing || new Node(nodeName);
            if (!node.parent || node.parent !== parent) {
                parent.addChild(node);
            }
            node.setPosition(-20 + index * 44, 0, 0);

            node.getComponent(UITransform) || node.addComponent(UITransform);

            const sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
            sprite.color = DrawingBoard.hexToColor(hex);

            const button = node.getComponent(Button) || node.addComponent(Button);
            buttons.push(button);
        });

        this.colorButtons = buttons;
    }

    private ensureTextLabel(parent: Node, text: string, fontSize: number): Label {
        let labelNode = parent.getChildByName('Label');
        if (!labelNode) {
            labelNode = new Node('Label');
            parent.addChild(labelNode);
        }
        labelNode.setPosition(0, 0, 0);

        const transform = labelNode.getComponent(UITransform) || labelNode.addComponent(UITransform);
        transform.setContentSize(32, 32);

        const label = labelNode.getComponent(Label) || labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 2;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = Color.BLACK;
        return label;
    }

    private bindCanvasEvents(): void {
        this.drawingCanvas.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.drawingCanvas.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.drawingCanvas.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.drawingCanvas.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private unbindCanvasEvents(): void {
        if (!this.drawingCanvas?.isValid) return;
        this.drawingCanvas.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.drawingCanvas.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.drawingCanvas.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.drawingCanvas.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private bindToolbarEvents(): void {
        this.clearButton?.node.on(Button.EventType.CLICK, this.clearCanvas, this);
        this.submitButton?.node.on(Button.EventType.CLICK, this.onSubmit, this);
        this.drawModeButton?.node.on(Button.EventType.CLICK, this.setDrawMode, this);
        this.eraserModeButton?.node.on(Button.EventType.CLICK, this.setEraserMode, this);

        this.colorButtons.forEach((button, index) => {
            const hex = FRONTEND_BRUSH_COLOR_HEXES[index];
            button?.node.on(Button.EventType.CLICK, () => {
                this.mode = 'draw';
                this.setBrushColorByHex(hex);
                this.refreshModeButtonState();
            }, this);
        });
    }

    private unbindToolbarEvents(): void {
        this.clearButton?.node.off(Button.EventType.CLICK, this.clearCanvas, this);
        this.submitButton?.node.off(Button.EventType.CLICK, this.onSubmit, this);
        this.drawModeButton?.node.off(Button.EventType.CLICK, this.setDrawMode, this);
        this.eraserModeButton?.node.off(Button.EventType.CLICK, this.setEraserMode, this);
        this.colorButtons.forEach((button) => button?.node.off(Button.EventType.CLICK));
    }

    private applyToolbarIcons(): void {
        this.applyRemoteIcon(this.drawModeButton, DRAW_ICON_URL, '画');
        this.applyRemoteIcon(this.eraserModeButton, ERASER_ICON_URL, '擦');
        this.applyRemoteIcon(this.submitButton, SAVE_ICON_URL, '存');
    }

    private applyRemoteIcon(button: Button | null, url: string, fallbackText: string): void {
        const node = button?.node;
        if (!node?.isValid) {
            return;
        }

        const sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
        assetManager.loadRemote<ImageAsset>(url, { ext: '.png' }, (err, imageAsset) => {
            if (err || !imageAsset) {
                ccWarn(`[DrawingBoard] 加载图标失败：${url}`, err);
                this.ensureTextLabel(node, fallbackText, 16);
                return;
            }

            const texture = new Texture2D();
            texture.image = imageAsset;
            const frame = new SpriteFrame();
            frame.texture = texture;

            this.toolbarTextures.push(texture);
            this.toolbarSpriteFrames.push(frame);
            sprite.spriteFrame = frame;

            const labelNode = node.getChildByName('Label');
            if (labelNode) {
                labelNode.active = false;
            }
        });
    }


    private applyColorButtonStyles(): void {
        this.colorButtons.forEach((button, index) => {
            const sprite = button?.node?.getComponent(Sprite);
            if (!sprite) return;
            sprite.color = DrawingBoard.hexToColor(FRONTEND_BRUSH_COLOR_HEXES[index]);
        });
    }

    private refreshModeButtonState(): void {
        const drawSprite = this.drawModeButton?.node?.getComponent(Sprite);
        const eraserSprite = this.eraserModeButton?.node?.getComponent(Sprite);

        if (drawSprite) {
            drawSprite.color = this.mode === 'draw' ? new Color(255, 236, 135, 255) : Color.WHITE;
        }
        if (eraserSprite) {
            eraserSprite.color = this.mode === 'eraser' ? new Color(255, 236, 135, 255) : Color.WHITE;
        }
    }

    private setDrawMode(): void {
        this.mode = 'draw';
        this.refreshModeButtonState();
    }

    private setEraserMode(): void {
        this.mode = 'eraser';
        this.refreshModeButtonState();
    }

    private getStrokeColor(mode: BrushMode, baseColor: Color): Color {
        return mode === 'eraser' ? CANVAS_BACKGROUND_COLOR.clone() : baseColor.clone();
    }

    private createStroke(point: Vec2): StrokeOperation {
        return {
            mode: this.mode,
            color: this.getStrokeColor(this.mode, this.brushColor),
            size: this.brushSize,
            points: [point.clone()],
        };
    }

    private onTouchStart(event: EventTouch): void {
        const touchPos = this.getTouchPosition(event);
        if (!touchPos || !this.graphics) {
            return;
        }

        this.isDrawing = true;
        this.lastPoint.set(touchPos);
        this.currentStroke = this.createStroke(touchPos);
        this.drawDot(touchPos, this.currentStroke);
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.isDrawing || !this.graphics || !this.currentStroke) return;

        const touchPos = this.getTouchPosition(event);
        if (!touchPos) return;

        this.currentStroke.points.push(touchPos.clone());
        this.drawSegment(this.lastPoint, touchPos, this.currentStroke);
        this.lastPoint.set(touchPos);
    }

    private onTouchEnd(): void {
        if (this.currentStroke) {
            this.pushStroke(this.currentStroke);
            this.currentStroke = null;
        }
        this.isDrawing = false;
    }

    private pushStroke(stroke: StrokeOperation): void {
        this.strokeHistory.push(stroke);
        if (this.strokeHistory.length > MAX_STROKE_HISTORY) {
            this.strokeHistory.shift();
        }
    }

    private drawDot(point: Vec2, stroke: StrokeOperation): void {
        if (!this.graphics) return;
        this.graphics.fillColor = stroke.color;
        this.graphics.circle(point.x, point.y, Math.max(1, stroke.size / 2));
        this.graphics.fill();
    }

    private drawSegment(from: Vec2, to: Vec2, stroke: StrokeOperation): void {
        if (!this.graphics) return;
        this.graphics.lineWidth = stroke.size;
        this.graphics.strokeColor = stroke.color;
        this.graphics.moveTo(from.x, from.y);
        this.graphics.lineTo(to.x, to.y);
        this.graphics.stroke();
    }

    private fillCanvasBackground(): void {
        if (!this.graphics) return;
        const transform = this.drawingCanvas.getComponent(UITransform);
        if (!transform) return;

        this.graphics.fillColor = CANVAS_BACKGROUND_COLOR;
        this.graphics.rect(-transform.width / 2, -transform.height / 2, transform.width, transform.height);
        this.graphics.fill();
    }

    private getTouchPosition(event: EventTouch): Vec2 | null {
        const uiTransform = this.drawingCanvas.getComponent(UITransform);
        if (!uiTransform) return null;

        const touchLocation = event.getUILocation();
        const localPos = uiTransform.convertToNodeSpaceAR(new Vec3(touchLocation.x, touchLocation.y, 0));
        return new Vec2(localPos.x, localPos.y);
    }

    private clearCanvas(): void {
        this.strokeHistory.length = 0;
        this.currentStroke = null;
        this.lastSubmitSignature = null;

        if (this.graphics) {
            this.graphics.clear();
            this.fillCanvasBackground();
            this.graphics.lineWidth = this.brushSize;
            this.graphics.strokeColor = this.getStrokeColor(this.mode, this.brushColor);
        }
    }

    private buildSubmitSignature(): string | null {
        if (this.strokeHistory.length === 0) {
            return null;
        }
        const lastStroke = this.strokeHistory[this.strokeHistory.length - 1];
        return `${this.strokeHistory.length}:${lastStroke.points.length}:${lastStroke.size}:${lastStroke.color.toHEX('#rrggbb')}`;
    }

    private onSubmit(): void {
        if (this.isSubmitting) {
            ccWarn('[DrawingBoard] 保存进行中，忽略重复点击');
            return;
        }

        const signature = this.buildSubmitSignature();
        if (!signature) {
            ccWarn('[DrawingBoard] 当前没有可保存的绘制内容');
            return;
        }

        if (signature === this.lastSubmitSignature) {
            ccWarn('[DrawingBoard] 忽略重复保存提交');
            return;
        }

        this.isSubmitting = true;
        try {
            ccLog('提交绘画，生成自定义鱼');
            const spriteFrame = this.captureSpriteFrame();
            if (!spriteFrame) {
                ccWarn('[DrawingBoard] 捕获画布失败，取消保存');
                return;
            }

            this.lastSubmitSignature = signature;
            const commitToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            this.node.emit('drawing-completed', spriteFrame, commitToken);
            this.clearCanvas();
        } finally {
            this.isSubmitting = false;
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

            const renderTexture = new RenderTexture();
            renderTexture.reset({
                width: width,
                height: height,
            });

            const originalTarget = this.camera ? this.camera.targetTexture : null;
            if (this.camera) {
                this.camera.targetTexture = renderTexture;
                this.camera.node.active = false;
                this.camera.node.active = true;
                this.camera.targetTexture = originalTarget;
            }

            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = renderTexture;

            ccLog('成功捕获画布内容为纹理');
            return spriteFrame;

        } catch (error) {
            ccError('捕获画布内容失败:', error);
            return null;
        }
    }

    /**
     * 设置画笔大小
     */
    public setBrushSize(size: number): void {
        this.brushSize = Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, Math.round(size)));
        if (this.graphics) {
            this.graphics.lineWidth = this.brushSize;
        }
    }

    /**
     * 设置画笔颜色
     */
    public setBrushColor(color: Color): void {
        this.brushColor = this.normalizeBrushColor(color);
        if (this.graphics && this.mode === 'draw') {
            this.graphics.strokeColor = this.brushColor;
        }
    }

    public setBrushColorByHex(hex: string): boolean {
        const mapped = DrawingBoard.findAllowedBrushColor(DrawingBoard.hexToColor(hex));
        if (!mapped) {
            ccWarn(`[DrawingBoard] 未命中色板颜色: ${hex}`);
            return false;
        }

        this.setBrushColor(mapped.clone());
        this.mode = 'draw';
        this.refreshModeButtonState();
        return true;
    }

    public getAvailableBrushColorHexes(): readonly string[] {
        return [...FRONTEND_BRUSH_COLOR_HEXES];
    }
}
