import { _decorator, Component, Node, Prefab, instantiate, SpriteFrame, Vec3, log as ccLog, warn as ccWarn } from 'cc';
import { CustomFish } from './CustomFish';
const { ccclass, property } = _decorator;

/**
 * 自定义鱼生成器
 * 负责接收画板的绘画结果，生成自定义鱼并添加到鱼缸中
 */
@ccclass('FishSpawner')
export class FishSpawner extends Component {
    @property(Prefab)
    fishPrefab: Prefab = null!;

    @property(Node)
    fishContainer: Node = null!;

    @property(Node)
    drawingBoard: Node = null!;

    @property({ type: Number })
    maxFishCount: number = 10;

    private fishList: Node[] = [];

    onLoad() {
        // 监听画板完成事件
        if (this.drawingBoard) {
            this.drawingBoard.on('drawing-completed', this.onDrawingCompleted, this);
        }
    }

    onDestroy() {
        if (this.drawingBoard) {
            this.drawingBoard.off('drawing-completed', this.onDrawingCompleted, this);
        }
    }

    /**
     * 处理绘画完成事件
     */
    private onDrawingCompleted(spriteFrame: SpriteFrame) {
        ccLog('收到绘画完成事件，准备生成鱼');
        this.spawnCustomFish(spriteFrame);
    }

    /**
     * 生成自定义鱼
     */
    public spawnCustomFish(spriteFrame: SpriteFrame) {
        // 检查鱼的数量限制
        if (this.fishList.length >= this.maxFishCount) {
            ccWarn(`已达到最大鱼数量限制 (${this.maxFishCount})`);
            // 移除最老的鱼
            const oldestFish = this.fishList.shift();
            if (oldestFish) {
                oldestFish.destroy();
            }
        }

        // 实例化鱼预制体
        let fishNode: Node;

        if (this.fishPrefab) {
            fishNode = instantiate(this.fishPrefab);
        } else {
            // 如果没有预制体，创建一个简单的节点
            fishNode = new Node('CustomFish');
            fishNode.addComponent(CustomFish);
        }

        // 设置父节点
        if (this.fishContainer) {
            fishNode.setParent(this.fishContainer);
        } else {
            fishNode.setParent(this.node);
        }

        // 设置初始位置（屏幕中心偏下）
        fishNode.setPosition(new Vec3(0, -200, 0));

        // 获取或添加 CustomFish 组件
        let customFish = fishNode.getComponent(CustomFish);
        if (!customFish) {
            customFish = fishNode.addComponent(CustomFish);
        }

        // 设置自定义纹理
        if (customFish) {
            customFish.setTexture(spriteFrame);
        }

        // 添加到鱼列表
        this.fishList.push(fishNode);

        ccLog(`成功生成自定义鱼，当前鱼数量: ${this.fishList.length}`);
    }

    /**
     * 清除所有鱼
     */
    public clearAllFish() {
        this.fishList.forEach(fish => {
            if (fish && fish.isValid) {
                fish.destroy();
            }
        });
        this.fishList = [];
    }

    /**
     * 获取当前鱼的数量
     */
    public getFishCount(): number {
        return this.fishList.length;
    }
}
