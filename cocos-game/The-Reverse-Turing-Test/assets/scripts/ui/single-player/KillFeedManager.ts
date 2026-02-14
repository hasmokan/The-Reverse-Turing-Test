import {
    _decorator, Component, Node, Label, UITransform, UIOpacity,
    Color, tween, Vec3, Sprite, Size
} from 'cc';

const { ccclass, property } = _decorator;

// 抓到AI的俏皮话
const AI_KILL_MESSAGES: string[] = [
    '火眼金睛！这条AI鱼被你揪出来了 🎯',
    '好眼力！假鱼无处遁形 👀',
    '又一条AI落网，你是捕鱼达人！🐟',
    '精准打击！AI鱼原形毕露 💥',
    '厉害了！这都能看出来 🏆',
    '一眼真一眼假，你选对了！✨',
    'AI画师哭晕在厕所 😭',
    '鉴鱼大师实锤了！🔍',
];

// 误杀人类的文案
const HUMAN_KILL_MESSAGES: string[] = [
    '糟糕！这是人类画的鱼啊... 😱',
    '冤枉好鱼了！这可是真迹 💔',
    '误伤友军！小心点啊 ⚠️',
    '这条是人画的...眼神不太好使？👓',
    '友军倒下了，注意甄别！😰',
    '真鱼被你送走了...心疼 💧',
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
        const message = messages[Math.floor(Math.random() * messages.length)];
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
        label.string = `「${fishName}」${isAI ? '被淘汰！' : '被误杀...'} ${message}`;
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
