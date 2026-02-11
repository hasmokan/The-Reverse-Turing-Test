import { _decorator, Component, Node, Sprite, SpriteFrame, Vec3, tween, UITransform } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 自定义鱼组件
 * 使用玩家绘制的纹理作为鱼的外观
 */
@ccclass('CustomFish')
export class CustomFish extends Component {
    @property(Sprite)
    fishSprite: Sprite = null!;

    @property({ type: Number })
    swimSpeed: number = 50;

    @property({ type: Number })
    swimRadius: number = 100;

    private targetPosition: Vec3 = new Vec3();
    private isMoving: boolean = false;

    onLoad() {
        if (!this.fishSprite) {
            this.fishSprite = this.node.getComponent(Sprite) || this.node.addComponent(Sprite);
        }
    }

    start() {
        // 开始游动
        this.startSwimming();
    }

    /**
     * 设置鱼的外观纹理
     */
    public setTexture(spriteFrame: SpriteFrame) {
        if (this.fishSprite) {
            this.fishSprite.spriteFrame = spriteFrame;
            console.log('设置自定义鱼纹理成功');
        }
    }

    /**
     * 开始游动动画
     */
    private startSwimming() {
        this.swimToRandomPosition();
    }

    /**
     * 游向随机位置
     */
    private swimToRandomPosition() {
        if (this.isMoving) return;

        // 获取画布尺寸作为边界
        const canvas = this.node.parent;
        if (!canvas) {
            // 如果没有父节点，使用默认范围
            this.targetPosition.set(
                (Math.random() - 0.5) * this.swimRadius * 2,
                (Math.random() - 0.5) * this.swimRadius * 2,
                0
            );
        } else {
            const transform = canvas.getComponent(UITransform);
            if (transform) {
                const halfWidth = transform.width / 2 - 50; // 留出边距
                const halfHeight = transform.height / 2 - 50;

                this.targetPosition.set(
                    (Math.random() - 0.5) * halfWidth * 2,
                    (Math.random() - 0.5) * halfHeight * 2,
                    0
                );
            }
        }

        const distance = Vec3.distance(this.node.position, this.targetPosition);
        const duration = distance / this.swimSpeed;

        this.isMoving = true;

        // 调整鱼的朝向
        if (this.targetPosition.x < this.node.position.x) {
            this.node.setScale(-1, 1, 1); // 向左游
        } else {
            this.node.setScale(1, 1, 1); // 向右游
        }

        // 使用 tween 移动到目标位置
        tween(this.node)
            .to(duration, { position: this.targetPosition }, {
                easing: 'sineInOut'
            })
            .call(() => {
                this.isMoving = false;
                // 到达目标后，随机延迟后继续游动
                this.scheduleOnce(() => {
                    this.swimToRandomPosition();
                }, Math.random() * 2 + 1); // 1-3秒随机延迟
            })
            .start();
    }

    /**
     * 停止游动
     */
    public stopSwimming() {
        tween(this.node).stop();
        this.isMoving = false;
    }

    onDestroy() {
        this.stopSwimming();
    }
}
