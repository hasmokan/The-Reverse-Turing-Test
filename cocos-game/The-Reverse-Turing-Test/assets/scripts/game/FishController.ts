import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform,
         Vec3, tween, Tween, assetManager, Texture2D, ImageAsset } from 'cc';
import { GameManager } from '../core/GameManager';
import { GameItem, ToastType } from '../data/GameTypes';
import { PHYSICS_CONFIG, BATTLE_CONSTANTS } from '../data/GameConstants';
import { VoteDisplay } from '../ui/multiplayer/VoteDisplay';

const { ccclass, property } = _decorator;

/**
 * 鱼的行为控制器
 * 迁移自: frontend/src/components/stage/GameStage.tsx 中的鱼动画逻辑
 */
@ccclass('FishController')
export class FishController extends Component {
    @property(Sprite)
    fishSprite: Sprite = null!;

    @property(Node)
    voteCountNode: Node = null!;  // 显示票数的节点

    @property(VoteDisplay)
    voteDisplay: VoteDisplay = null!;  // 票数显示组件

    // 鱼的数据
    private _itemId: string = '';
    private _isAI: boolean = false;
    private _velocity: { vx: number; vy: number } = { vx: 0, vy: 0 };
    private _flipX: boolean = false;

    // 物理边界
    private _bounds = PHYSICS_CONFIG.BOUNDS;

    // 浮动动画
    private _phaseOffset: number = 0;
    private _floatTween: Tween<Node> | null = null;

    // 交互状态
    private _isEliminated: boolean = false;

    /**
     * 初始化鱼
     */
    init(item: GameItem): void {
        this._itemId = item.id;
        this._isAI = item.isAI;
        this._velocity = { ...item.velocity };
        this._flipX = item.flipX;

        // 生成随机相位偏移，让每条鱼的浮动动画不同步
        this._phaseOffset = parseInt(item.id, 36) % 100;

        // 设置位置
        this.node.setPosition(item.position.x, item.position.y, 0);

        // 设置缩放
        this.node.setScale(item.scale, item.scale, 1);

        // 设置旋转
        this.node.angle = item.rotation;

        // 加载图片
        this.loadFishImage(item.imageUrl);

        // 设置朝向
        this.updateFlip();

        // 启动浮动动画
        this.startFloatAnimation();

        // 绑定点击事件
        this.node.on(Node.EventType.TOUCH_END, this.onClick, this);

        // 入场动画
        this.playEnterAnimation(item.scale);
    }

    /**
     * 加载鱼的图片
     */
    private loadFishImage(imageUrl: string): void {
        if (!imageUrl) return;

        if (imageUrl.startsWith('local-sprite://')) {
            const fishId = imageUrl.replace('local-sprite://', '');
            const localSpriteFrame = GameManager.instance.getLocalFishSpriteFrame(fishId);
            if (localSpriteFrame && this.fishSprite) {
                this.fishSprite.spriteFrame = localSpriteFrame;
            }
            return;
        }

        // 检查是否是 Base64 数据
        if (imageUrl.startsWith('data:image')) {
            this.loadBase64Image(imageUrl);
        } else if (imageUrl.startsWith('http')) {
            this.loadRemoteImage(imageUrl);
        }
    }

    /**
     * 加载 Base64 图片
     */
    private loadBase64Image(base64: string): void {
        const img = new Image();
        img.onload = () => {
            const texture = new Texture2D();
            texture.image = new ImageAsset(img);

            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;

            if (this.fishSprite) {
                this.fishSprite.spriteFrame = spriteFrame;
            }
        };
        img.src = base64;
    }

    /**
     * 加载远程图片
     */
    private loadRemoteImage(url: string): void {
        assetManager.loadRemote<ImageAsset>(url, (err, imageAsset) => {
            if (err) {
                console.error('[FishController] Load image failed:', err);
                return;
            }

            const texture = new Texture2D();
            texture.image = imageAsset;

            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;

            if (this.fishSprite) {
                this.fishSprite.spriteFrame = spriteFrame;
            }
        });
    }

    /**
     * 入场动画
     */
    private playEnterAnimation(targetScale: number): void {
        this.node.setScale(0, 0, 1);
        tween(this.node)
            .to(0.3, { scale: new Vec3(targetScale, targetScale, 1) }, { easing: 'backOut' })
            .start();
    }

    /**
     * 启动浮动动画
     */
    private startFloatAnimation(): void {
        const floatConfig = PHYSICS_CONFIG.FLOAT;
        const duration = 2 + (this._phaseOffset % 10) * 0.1;

        // 使用 Tween 创建上下浮动
        this._floatTween = tween(this.node)
            .by(duration / 2, { position: new Vec3(0, 8, 0) }, { easing: 'sineInOut' })
            .by(duration / 2, { position: new Vec3(0, -8, 0) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    /**
     * 每帧更新 - 处理游泳物理
     */
    update(dt: number): void {
        if (this._isEliminated) return;

        const pos = this.node.position;
        let newX = pos.x + this._velocity.vx;
        let newY = pos.y + this._velocity.vy * 0.3;

        // 正弦波上下浮动 (与 Tween 叠加)
        const time = Date.now() / 1000;
        const floatSpeed = 0.6 + (this._phaseOffset % 10) * 0.08;
        const floatOffset = Math.sin(time * floatSpeed + this._phaseOffset) * 12 * 0.15;
        newY += floatOffset * dt * 60;

        // 边界检测 - 水平方向
        if (newX <= this._bounds.MIN_X) {
            newX = this._bounds.MIN_X;
            this._velocity.vx = Math.abs(this._velocity.vx);
            this._flipX = false;
            this.updateFlip();
        } else if (newX >= this._bounds.MAX_X) {
            newX = this._bounds.MAX_X;
            this._velocity.vx = -Math.abs(this._velocity.vx);
            this._flipX = true;
            this.updateFlip();
        }

        // 边界检测 - 垂直方向
        if (newY < this._bounds.MIN_Y) {
            newY = this._bounds.MIN_Y;
            this._velocity.vy = Math.abs(this._velocity.vy) * 0.5;
        } else if (newY > this._bounds.MAX_Y) {
            newY = this._bounds.MAX_Y;
            this._velocity.vy = -Math.abs(this._velocity.vy) * 0.5;
        }

        // 旋转跟随垂直运动
        const targetRotation = this._velocity.vy * 2;
        const currentRotation = this.node.angle;
        this.node.angle = currentRotation + (targetRotation - currentRotation) * 0.1;

        // 更新位置
        this.node.setPosition(newX, newY, 0);
    }

    /**
     * 更新朝向
     */
    private updateFlip(): void {
        const scale = this.node.scale;
        const scaleX = this._flipX ? -Math.abs(scale.x) : Math.abs(scale.x);
        this.node.setScale(scaleX, scale.y, scale.z);
    }

    /**
     * 点击事件处理
     */
    private onClick(): void {
        if (this._isEliminated) return;

        const item = GameManager.instance.getItem(this._itemId);
        if (item) {
            // 发送点击事件
            GameManager.instance.events.emit(GameManager.EVENT.FISH_CLICKED, item);
        }
    }

    /**
     * 更新票数显示
     */
    updateVoteDisplay(count: number): void {
        // 使用新的 VoteDisplay 组件
        if (this.voteDisplay) {
            this.voteDisplay.updateCount(count);
        }

        // 兼容旧的 voteCountNode
        if (this.voteCountNode) {
            this.voteCountNode.active = count > 0;
        }
    }

    /**
     * 播放被攻击效果
     */
    playHitEffect(): void {
        // 闪烁效果
        tween(this.node)
            .to(0.05, { scale: new Vec3(this.node.scale.x * 1.1, this.node.scale.y * 1.1, 1) })
            .to(0.05, { scale: new Vec3(this.node.scale.x, this.node.scale.y, 1) })
            .start();
    }

    /**
     * 播放淘汰动画
     */
    playEliminateAnimation(callback?: () => void): void {
        this._isEliminated = true;

        // 停止浮动动画
        if (this._floatTween) {
            this._floatTween.stop();
        }

        // 淘汰动画: 缩小 + 旋转 + 淡出
        tween(this.node)
            .to(0.3, {
                scale: new Vec3(0, 0, 1),
                angle: this.node.angle + 360
            }, { easing: 'backIn' })
            .call(() => {
                if (callback) callback();
                this.node.destroy();
            })
            .start();
    }

    /**
     * 应用更新
     */
    applyUpdates(updates: Partial<GameItem>): void {
        if (updates.velocity) {
            this._velocity = { ...updates.velocity };
        }
        if (updates.flipX !== undefined) {
            this._flipX = updates.flipX;
            this.updateFlip();
        }
    }

    // ==================== Getters ====================

    get itemId(): string { return this._itemId; }
    get isAI(): boolean { return this._isAI; }
    get isEliminated(): boolean { return this._isEliminated; }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        if (this._floatTween) {
            this._floatTween.stop();
        }
        this.node.off(Node.EventType.TOUCH_END, this.onClick, this);
    }
}
