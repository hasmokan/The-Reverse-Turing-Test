import { _decorator, Component, Node, Label, Sprite, Button, Color,
         tween, Vec3, UIOpacity, SpriteFrame, Texture2D, ImageAsset } from 'cc';
import { GameManager } from '../../core/GameManager';
import { BattleSystem, BattleActionType } from '../../game/BattleSystem';
import { GameItem, ToastType } from '../../data/GameTypes';
import { BATTLE_CONSTANTS } from '../../data/GameConstants';

const { ccclass, property } = _decorator;

/**
 * 鱼详情面板
 * 点击鱼后显示的详细信息面板
 *
 * 功能：
 * - 显示鱼的图片、名称、作者
 * - 显示当前票数和投票者
 * - 提供投票/追击/换目标按钮
 * - 显示评论列表
 */
@ccclass('FishDetailPanel')
export class FishDetailPanel extends Component {
    // ==================== UI 引用 ====================

    @property(Node)
    panelRoot: Node = null!;               // 面板根节点

    @property(Node)
    maskNode: Node = null!;                // 背景遮罩

    @property(Sprite)
    fishImage: Sprite = null!;             // 鱼的图片

    @property(Label)
    fishNameLabel: Label = null!;          // 鱼的名称

    @property(Label)
    authorLabel: Label = null!;            // 作者名称

    @property(Label)
    descriptionLabel: Label = null!;       // 描述

    @property(Label)
    voteCountLabel: Label = null!;         // 票数标签

    @property(Label)
    votersLabel: Label = null!;            // 投票者列表

    @property(Node)
    voteProgressBar: Node = null!;         // 投票进度条

    @property(Sprite)
    voteProgressFill: Sprite = null!;      // 进度条填充

    @property(Button)
    actionButton: Button = null!;          // 操作按钮（投票/追击/换目标）

    @property(Label)
    actionButtonLabel: Label = null!;      // 按钮文字

    @property(Button)
    closeButton: Button = null!;           // 关闭按钮

    @property(Node)
    commentsContainer: Node = null!;       // 评论容器

    @property(Node)
    commentItemPrefab: Node = null!;       // 评论项模板

    // ==================== 颜色配置 ====================

    private readonly COLOR_VOTE = new Color(76, 175, 80, 255);      // 绿色 - 投票
    private readonly COLOR_CHASE = new Color(255, 152, 0, 255);     // 橙色 - 追击
    private readonly COLOR_SWITCH = new Color(33, 150, 243, 255);   // 蓝色 - 换目标
    private readonly COLOR_DISABLED = new Color(158, 158, 158, 255); // 灰色 - 禁用
    private readonly COLOR_SELF = new Color(156, 39, 176, 255);     // 紫色 - 自己的鱼

    // ==================== 状态 ====================

    private _currentItem: GameItem | null = null;
    private _isVisible: boolean = false;

    // ==================== 生命周期 ====================

    start() {
        this.bindEvents();
        this.hide(false);
    }

    /**
     * 绑定事件
     */
    private bindEvents(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.on(GameManager.EVENT.FISH_CLICKED, this.onFishClicked, this);
            gm.events.on(GameManager.EVENT.VOTES_UPDATED, this.onVotesUpdated, this);
            gm.events.on(GameManager.EVENT.ITEM_REMOVED, this.onItemRemoved, this);
        }

        // 关闭按钮
        if (this.closeButton) {
            this.closeButton.node.on(Button.EventType.CLICK, this.onCloseClick, this);
        }

        // 操作按钮
        if (this.actionButton) {
            this.actionButton.node.on(Button.EventType.CLICK, this.onActionClick, this);
        }

        // 遮罩点击关闭
        if (this.maskNode) {
            this.maskNode.on(Node.EventType.TOUCH_END, this.onMaskClick, this);
        }
    }

    // ==================== 事件处理 ====================

    /**
     * 鱼被点击事件
     */
    private onFishClicked(item: GameItem): void {
        this.showItem(item);
    }

    /**
     * 票数更新事件
     */
    private onVotesUpdated(fishId: string, count: number, voters: string[]): void {
        if (this._currentItem && this._currentItem.id === fishId) {
            this.updateVoteDisplay(count, voters);
        }
    }

    /**
     * 物品移除事件
     */
    private onItemRemoved(itemId: string): void {
        if (this._currentItem && this._currentItem.id === itemId) {
            this.hide();
        }
    }

    /**
     * 关闭按钮点击
     */
    private onCloseClick(): void {
        this.hide();
    }

    /**
     * 遮罩点击
     */
    private onMaskClick(): void {
        this.hide();
    }

    /**
     * 操作按钮点击
     */
    private onActionClick(): void {
        if (!this._currentItem) return;

        const gm = GameManager.instance;
        const fishId = this._currentItem.id;

        // 检查是否是自己的鱼
        if (fishId === gm.playerFishId) {
            gm.showToast(ToastType.WARNING, '不能攻击自己的鱼！');
            return;
        }

        // 执行战斗操作
        const result = BattleSystem.instance.executeAction(fishId);

        if (result) {
            // 更新按钮状态
            this.updateActionButton();
        }
    }

    // ==================== 显示控制 ====================

    /**
     * 显示指定物品的详情
     */
    showItem(item: GameItem): void {
        this._currentItem = item;

        // 更新显示内容
        this.updateDisplay();

        // 显示面板
        this.show();
    }

    /**
     * 显示面板
     */
    show(): void {
        if (this._isVisible) return;
        this._isVisible = true;

        this.node.active = true;

        // 遮罩淡入
        if (this.maskNode) {
            const maskOpacity = this.maskNode.getComponent(UIOpacity) || this.maskNode.addComponent(UIOpacity);
            maskOpacity.opacity = 0;
            tween(maskOpacity)
                .to(0.2, { opacity: 180 })
                .start();
        }

        // 面板弹出
        if (this.panelRoot) {
            this.panelRoot.setScale(0.8, 0.8, 1);
            const panelOpacity = this.panelRoot.getComponent(UIOpacity) || this.panelRoot.addComponent(UIOpacity);
            panelOpacity.opacity = 0;

            tween(this.panelRoot)
                .to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();

            tween(panelOpacity)
                .to(0.2, { opacity: 255 })
                .start();
        }
    }

    /**
     * 隐藏面板
     */
    hide(animate: boolean = true): void {
        if (!this._isVisible && animate) return;
        this._isVisible = false;

        if (!animate) {
            this.node.active = false;
            this._currentItem = null;
            return;
        }

        // 遮罩淡出
        if (this.maskNode) {
            const maskOpacity = this.maskNode.getComponent(UIOpacity);
            if (maskOpacity) {
                tween(maskOpacity)
                    .to(0.15, { opacity: 0 })
                    .start();
            }
        }

        // 面板收起
        if (this.panelRoot) {
            const panelOpacity = this.panelRoot.getComponent(UIOpacity);

            tween(this.panelRoot)
                .to(0.15, { scale: new Vec3(0.8, 0.8, 1) })
                .call(() => {
                    this.node.active = false;
                    this._currentItem = null;
                })
                .start();

            if (panelOpacity) {
                tween(panelOpacity)
                    .to(0.15, { opacity: 0 })
                    .start();
            }
        } else {
            this.node.active = false;
            this._currentItem = null;
        }
    }

    // ==================== 显示更新 ====================

    /**
     * 更新所有显示
     */
    private updateDisplay(): void {
        if (!this._currentItem) return;

        const item = this._currentItem;
        const gm = GameManager.instance;

        // 加载图片
        this.loadFishImage(item.imageUrl);

        // 名称
        if (this.fishNameLabel) {
            this.fishNameLabel.string = item.name || '未命名的鱼';
        }

        // 作者
        if (this.authorLabel) {
            const isSelf = item.id === gm.playerFishId;
            this.authorLabel.string = isSelf ? '你的鱼' : `作者: ${item.author}`;
            this.authorLabel.color = isSelf ? this.COLOR_SELF : Color.WHITE;
        }

        // 描述
        if (this.descriptionLabel) {
            this.descriptionLabel.string = item.description || '这条鱼没有描述';
        }

        // 票数
        const voteCount = gm.getVoteCount(item.id);
        const voters = gm.getVoters(item.id);
        this.updateVoteDisplay(voteCount, voters);

        // 操作按钮
        this.updateActionButton();

        // 评论
        this.updateComments(item.comments);
    }

    /**
     * 加载鱼的图片
     */
    private loadFishImage(imageUrl: string): void {
        if (!this.fishImage || !imageUrl) return;

        if (imageUrl.startsWith('data:image')) {
            // Base64 图片
            const img = new Image();
            img.onload = () => {
                const texture = new Texture2D();
                texture.image = new ImageAsset(img);

                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;

                if (this.fishImage) {
                    this.fishImage.spriteFrame = spriteFrame;
                }
            };
            img.src = imageUrl;
        }
    }

    /**
     * 更新票数显示
     */
    private updateVoteDisplay(count: number, voters: string[]): void {
        // 票数
        if (this.voteCountLabel) {
            this.voteCountLabel.string = `${count} / ${BATTLE_CONSTANTS.ELIMINATION_THRESHOLD}`;

            // 颜色
            if (count >= BATTLE_CONSTANTS.ELIMINATION_THRESHOLD) {
                this.voteCountLabel.color = new Color(244, 67, 54, 255);
            } else if (count >= BATTLE_CONSTANTS.ELIMINATION_THRESHOLD - 1) {
                this.voteCountLabel.color = new Color(255, 152, 0, 255);
            } else {
                this.voteCountLabel.color = Color.WHITE;
            }
        }

        // 投票者列表
        if (this.votersLabel) {
            if (voters.length > 0) {
                this.votersLabel.string = `投票者: ${voters.join(', ')}`;
            } else {
                this.votersLabel.string = '暂无投票';
            }
        }

        // 进度条
        if (this.voteProgressFill) {
            const progress = Math.min(1, count / BATTLE_CONSTANTS.ELIMINATION_THRESHOLD);
            this.voteProgressFill.fillRange = progress;

            // 颜色
            if (count >= BATTLE_CONSTANTS.ELIMINATION_THRESHOLD) {
                this.voteProgressFill.color = new Color(244, 67, 54, 255);
            } else if (count >= BATTLE_CONSTANTS.ELIMINATION_THRESHOLD - 1) {
                this.voteProgressFill.color = new Color(255, 152, 0, 255);
            } else {
                this.voteProgressFill.color = new Color(76, 175, 80, 255);
            }
        }
    }

    /**
     * 更新操作按钮
     */
    private updateActionButton(): void {
        if (!this.actionButton || !this._currentItem) return;

        const gm = GameManager.instance;
        const fishId = this._currentItem.id;
        const bullet = gm.bullet;

        // 检查是否是自己的鱼
        if (fishId === gm.playerFishId) {
            this.setButtonState('自己的鱼', this.COLOR_DISABLED, false);
            return;
        }

        // 检查 CD
        if (!bullet.loaded) {
            const remaining = BattleSystem.instance.getCooldownRemaining();
            this.setButtonState(`冷却中 ${(remaining / 1000).toFixed(1)}s`, this.COLOR_DISABLED, false);
            return;
        }

        // 判断操作类型
        if (bullet.currentTarget === fishId) {
            // 追击
            this.setButtonState('追击', this.COLOR_CHASE, true);
        } else if (bullet.currentTarget) {
            // 换目标
            this.setButtonState('换目标', this.COLOR_SWITCH, true);
        } else {
            // 投票
            this.setButtonState('投票', this.COLOR_VOTE, true);
        }
    }

    /**
     * 设置按钮状态
     */
    private setButtonState(text: string, color: Color, interactable: boolean): void {
        if (this.actionButtonLabel) {
            this.actionButtonLabel.string = text;
        }

        if (this.actionButton) {
            this.actionButton.interactable = interactable;

            // 更新按钮颜色
            const sprite = this.actionButton.node.getComponent(Sprite);
            if (sprite) {
                sprite.color = color;
            }
        }
    }

    /**
     * 更新评论列表
     */
    private updateComments(comments: any[]): void {
        if (!this.commentsContainer) return;

        // 清空现有评论
        this.commentsContainer.removeAllChildren();

        // 添加评论
        comments.forEach(comment => {
            // TODO: 使用 Prefab 创建评论项
            // 这里简化处理，实际应该使用 Prefab
        });
    }

    // ==================== 定时更新 ====================

    update(dt: number): void {
        // 更新 CD 显示
        if (this._isVisible && this._currentItem) {
            const gm = GameManager.instance;
            if (!gm.bullet.loaded) {
                this.updateActionButton();
            }
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 获取当前显示的物品
     */
    getCurrentItem(): GameItem | null {
        return this._currentItem;
    }

    /**
     * 是否可见
     */
    isVisible(): boolean {
        return this._isVisible;
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.FISH_CLICKED, this.onFishClicked, this);
            gm.events.off(GameManager.EVENT.VOTES_UPDATED, this.onVotesUpdated, this);
            gm.events.off(GameManager.EVENT.ITEM_REMOVED, this.onItemRemoved, this);
        }
    }
}
