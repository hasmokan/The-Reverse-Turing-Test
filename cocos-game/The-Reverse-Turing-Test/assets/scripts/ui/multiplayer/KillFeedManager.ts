import {
    _decorator, Component, Node, Label, UITransform, UIOpacity,
    Color, tween, Vec3, Sprite, Size
} from 'cc';

const { ccclass, property } = _decorator;

// 抓到AI的俏皮话
const AI_KILL_MESSAGES: string[] = [
    '🤖 抓到了！[Name] 是一条假鱼！',
    '⚡ 核心击破！[Name] 已被移除。',
    '🐛 [Name] 是个 Bug，已被修复。',
    '🚫 拒绝合成肉！[Name] 被丢出了鱼缸。',
    '✅ [Name] 原形毕露！',
];

// 误杀人类的文案
const HUMAN_KILL_MESSAGES: string[] = [
    '😭 误杀！[Name] 是真的人类啊！',
    '💀 [Name] 画得太丑被当成 AI 抓走了...',
    '🥀 痛失队友！[Name] 离开了我们。',
    '🤷‍♂️ [Name]：我真的是人...(遗言)',
    '☠️ [Name] 惨遭献祭...',
];

/**
 * 击杀信息流管理器
 * 屏幕顶部浮动条，绿色=抓到AI，红色=误杀人类
 * 入场动画 + 自动消失，新消息顶替旧消息
 */
@ccclass('KillFeedManager')
export class KillFeedManager extends Component {

    // 当前显示的消息节点
    private _currentFeed: Node | null = null;

    /**
     * 显示击杀信息
     * @param fishName 被淘汰的鱼名称
     * @param isAI 是否是AI鱼
     */
    showKillFeed(fishName: string, isAI: boolean): void {
        // 移除旧消息
        if (this._currentFeed && this._currentFeed.isValid) {
            this._currentFeed.destroy();
            this._currentFeed = null;
        }

        const messages = isAI ? AI_KILL_MESSAGES : HUMAN_KILL_MESSAGES;
        const message = messages[Math.floor(Math.random() * messages.length)].replace('[Name]', fishName);
        const bgColor = isAI ? new Color(34, 139, 34, 220) : new Color(220, 50, 50, 220);

        // 创建消息节点
        const feedNode = new Node('KillFeed');
        this.node.addChild(feedNode);

        // 背景
        const bgSprite = feedNode.addComponent(Sprite);
        bgSprite.type = Sprite.Type.SIMPLE;
        bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSprite.color = bgColor;

        const uiTransform = feedNode.getComponent(UITransform) || feedNode.addComponent(UITransform);
        uiTransform.setContentSize(new Size(600, 50));
        uiTransform.setAnchorPoint(0.5, 0.5);

        // 文字
        const textNode = new Node('Text');
        feedNode.addChild(textNode);
        const label = textNode.addComponent(Label);
        label.string = message;
        label.fontSize = 18;
        label.color = Color.WHITE;
        label.overflow = Label.Overflow.SHRINK;
        const textTransform = textNode.getComponent(UITransform) || textNode.addComponent(UITransform);
        textTransform.setContentSize(new Size(580, 40));

        // 添加 UIOpacity 用于淡出
        const opacity = feedNode.addComponent(UIOpacity);
        opacity.opacity = 255;

        // 初始位置（从上方弹入）
        feedNode.setPosition(0, 80, 0);

        // 入场动画
        tween(feedNode)
            .to(0.3, { position: new Vec3(0, 0, 0) }, { easing: 'backOut' })
            .delay(2)
            .call(() => {
                // 淡出
                tween(opacity)
                    .to(0.3, { opacity: 0 })
                    .call(() => {
                        if (feedNode.isValid) {
                            feedNode.destroy();
                            if (this._currentFeed === feedNode) {
                                this._currentFeed = null;
                            }
                        }
                    })
                    .start();
            })
            .start();

        this._currentFeed = feedNode;
    }

    onDestroy(): void {
        if (this._currentFeed && this._currentFeed.isValid) {
            this._currentFeed.destroy();
        }
    }
}
