import { _decorator, Component, Sprite, SpriteFrame, CCBoolean } from 'cc';

const { ccclass, property, executeInEditMode } = _decorator;

/**
 * 编辑器占位图组件
 *
 * 用法：
 * 1. 把占位图拖到 placeholderFrame 属性
 * 2. 编辑器里能看到占位图，方便布局
 * 3. 运行时自动清除占位图（不影响动态加载逻辑）
 *
 * 打包时占位图是否被包含取决于 stripOnBuild：
 * - true:  onLoad 时清空 spriteFrame，但图片仍会被打包（因为场景引用了它）
 * - 配合 Asset Bundle 排除策略可彻底不打包（见方案二）
 */
@ccclass('EditorPlaceholder')
@executeInEditMode
export class EditorPlaceholder extends Component {

    @property(SpriteFrame)
    placeholderFrame: SpriteFrame = null!;

    @property({ type: CCBoolean, tooltip: '运行时是否自动清除占位图' })
    clearOnPlay: boolean = true;

    onLoad() {
        const sprite = this.getComponent(Sprite);
        if (!sprite) return;

        if (CC_EDITOR) {
            // 编辑器模式：显示占位图
            if (this.placeholderFrame && !sprite.spriteFrame) {
                sprite.spriteFrame = this.placeholderFrame;
            }
        } else if (this.clearOnPlay) {
            // 运行时：清除占位图，等待动态加载
            sprite.spriteFrame = null;
        }
    }
}
