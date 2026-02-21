import { _decorator, Component, Node, Label, Sprite, Button, Color,
         tween, Vec3, UIOpacity, SpriteFrame, Texture2D, ImageAsset, UITransform, Size, assetManager } from 'cc';
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
        this.ensureFallbackUI();
        this.bindEvents();
        this.hide(false);
    }

    /**
     * 如果场景里没绑引用，则动态创建一个最小可用弹窗
     */
    private ensureFallbackUI(): void {
        if (this.panelRoot && this.maskNode && this.actionButton && this.closeButton) {
            return;
        }

        this.node.active = true;

        if (!this.maskNode) {
            this.maskNode = new Node('Mask');
            this.node.addChild(this.maskNode);
            const maskTransform = this.maskNode.addComponent(UITransform);
            maskTransform.setContentSize(new Size(750, 1334));
            const maskSprite = this.maskNode.addComponent(Sprite);
            maskSprite.color = new Color(0, 0, 0, 160);
            this.maskNode.addComponent(UIOpacity).opacity = 0;
            this.maskNode.setPosition(0, 0, 0);
        }

        if (!this.panelRoot) {
            this.panelRoot = new Node('PanelRoot');
            this.node.addChild(this.panelRoot);
            const panelTransform = this.panelRoot.addComponent(UITransform);
            panelTransform.setContentSize(new Size(560, 760));
            const panelBg = this.panelRoot.addComponent(Sprite);
            panelBg.color = new Color(33, 40, 63, 245);
            this.panelRoot.addComponent(UIOpacity).opacity = 0;
            this.panelRoot.setPosition(0, 0, 1);
        }

        if (!this.fishImage) {
            const fishImageNode = new Node('FishImage');
            this.panelRoot.addChild(fishImageNode);
            fishImageNode.setPosition(0, 80, 0);
            const imageTransform = fishImageNode.addComponent(UITransform);
            imageTransform.setContentSize(new Size(260, 260));
            const imageSprite = fishImageNode.addComponent(Sprite);
            imageSprite.color = new Color(87, 105, 145, 255);
            this.fishImage = imageSprite;
        }

        if (!this.fishNameLabel) {
            this.fishNameLabel = this.createLabel(this.panelRoot, 'FishNameLabel', '未命名的鱼', 36, 0, 280);
        }
        if (!this.authorLabel) {
            this.authorLabel = this.createLabel(this.panelRoot, 'AuthorLabel', '作者: 未知', 24, 0, 235);
            this.authorLabel.color = new Color(207, 227, 255, 255);
        }
        if (!this.descriptionLabel) {
            this.descriptionLabel = this.createLabel(this.panelRoot, 'DescriptionLabel', '这条鱼没有描述', 24, 0, 180);
            this.descriptionLabel.overflow = Label.Overflow.SHRINK;
            const descTransform = this.descriptionLabel.node.getComponent(UITransform);
            descTransform?.setContentSize(new Size(500, 100));
        }
        if (!this.voteCountLabel) {
            this.voteCountLabel = this.createLabel(this.panelRoot, 'VoteCountLabel', '0 / 4', 30, 0, 95);
            this.voteCountLabel.color = new Color(140, 255, 174, 255);
        }
        if (!this.votersLabel) {
            this.votersLabel = this.createLabel(this.panelRoot, 'VotersLabel', '暂无投票', 20, 0, 55);
            this.votersLabel.color = new Color(200, 200, 200, 255);
        }
        if (!this.voteProgressBar || !this.voteProgressFill) {
            const progressRoot = new Node('VoteProgressBar');
            this.panelRoot.addChild(progressRoot);
            progressRoot.setPosition(0, 128, 0);
            const progressTransform = progressRoot.addComponent(UITransform);
            progressTransform.setContentSize(new Size(420, 18));
            const progressBg = progressRoot.addComponent(Sprite);
            progressBg.color = new Color(64, 72, 95, 255);

            const fillNode = new Node('Fill');
            progressRoot.addChild(fillNode);
            fillNode.setPosition(0, 0, 0);
            const fillTransform = fillNode.addComponent(UITransform);
            fillTransform.setContentSize(new Size(420, 18));
            const fillSprite = fillNode.addComponent(Sprite);
            fillSprite.color = new Color(76, 175, 80, 255);
            fillSprite.type = Sprite.Type.FILLED;
            fillSprite.fillType = Sprite.FillType.HORIZONTAL;
            fillSprite.fillStart = 0;
            fillSprite.fillRange = 0;

            this.voteProgressBar = progressRoot;
            this.voteProgressFill = fillSprite;
        }

        if (!this.actionButton) {
            this.actionButton = this.createButton(this.panelRoot, 'ActionButton', '就是它！', 0, -250, new Color(227, 68, 68, 255));
        }
        if (!this.actionButtonLabel) {
            const actionLabel = this.actionButton.node.getChildByName('Label')?.getComponent(Label);
            if (actionLabel) {
                this.actionButtonLabel = actionLabel;
            }
        }
        if (!this.closeButton) {
            this.closeButton = this.createButton(this.panelRoot, 'CloseButton', '关闭', 0, -330, new Color(120, 120, 120, 255));
        }
    }

    private createLabel(parent: Node, name: string, text: string, fontSize: number, x: number, y: number): Label {
        const node = new Node(name);
        parent.addChild(node);
        node.setPosition(x, y, 0);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(new Size(520, 46));
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.max(36, fontSize + 8);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = Color.WHITE;
        return label;
    }

    private createButton(parent: Node, name: string, text: string, x: number, y: number, color: Color): Button {
        const node = new Node(name);
        parent.addChild(node);
        node.setPosition(x, y, 0);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(new Size(330, 72));
        const sprite = node.addComponent(Sprite);
        sprite.color = color;

        const labelNode = new Node('Label');
        node.addChild(labelNode);
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(new Size(300, 60));
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 30;
        label.lineHeight = 40;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = Color.WHITE;

        return node.addComponent(Button);
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
            // 执行操作后关闭弹窗，保持战斗节奏
            this.hide();
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

        if (imageUrl.startsWith('local-sprite://')) {
            const fishId = imageUrl.replace('local-sprite://', '');
            const spriteFrame = GameManager.instance.getLocalFishSpriteFrame(fishId);
            if (spriteFrame) {
                this.fishImage.spriteFrame = spriteFrame;
            }
            return;
        }

        if (imageUrl.startsWith('data:image')) {
            // Base64 图片（跨平台走 assetManager，避免直接依赖浏览器 Image）
            assetManager.loadRemote<ImageAsset>(imageUrl, (err, imageAsset) => {
                if (err) {
                    console.error('[FishDetailPanel] Load base64 image failed:', err);
                    return;
                }

                const texture = new Texture2D();
                texture.image = imageAsset;

                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;

                if (this.fishImage) {
                    this.fishImage.spriteFrame = spriteFrame;
                }
            });
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
            this.setButtonState('追击！', this.COLOR_CHASE, true);
        } else if (bullet.currentTarget) {
            // 换目标
            this.setButtonState('换个目标', this.COLOR_SWITCH, true);
        } else {
            // 投票
            this.setButtonState('就是它！', this.COLOR_VOTE, true);
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
