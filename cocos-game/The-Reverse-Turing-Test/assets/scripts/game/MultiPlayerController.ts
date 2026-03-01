import {
    _decorator,
    Component,
    Node,
    Label,
    Button,
    Sprite,
    UITransform,
    ProgressBar,
    UIOpacity,
    SpriteFrame,
    Color,
    Vec3,
    tween,
    director,
    warn as ccWarn,
    error as ccError,
} from 'cc';
import { GameManager } from '../core/GameManager';
import { BattleSystem, LocalBattleCallbacks } from './BattleSystem';
import { AISpawner } from './AISpawner';
import { KillFeedManager } from '../ui/multiplayer/KillFeedManager';
import { GamePhase, EliminationData, ToastType } from '../data/GameTypes';
import { BATTLE_CONSTANTS } from '../data/GameConstants';

const { ccclass, property } = _decorator;

const MAX_ACTIVE_FISH = 5;
const CORPSE_HOLD_SECONDS = 30;
const LOCAL_SPRITE_PREFIX = 'local-sprite://';

const LOADING_TIPS = [
    '全球的鱼正在涌来...',
    'AI 正在披上伪装...',
    '正在给鱼缸换水...',
    '间谍鱼正在学习伪装术...',
    '正在检查有没有鱼在摸鱼...',
    '正在让鱼排队入场...',
];

const AUTO_FISH_NAMES = [
    '随便画画', '不太会画', '鱼鱼鱼', '小蓝', '阿强鱼',
    '咸鱼王', '摸鱼中', '深海路人',
];

const AUTO_FISH_DESC = [
    '就这样吧', '随手画的', '别太认真', '应该是条鱼',
    '画得一般', '看起来能游', '就它了', '先投放再说',
];

/**
 * 单人游戏阶段
 */
enum MultiPlayerPhase {
    DRAWING = 'drawing',
    VIEWING = 'viewing',
    VOTING = 'voting',
    GAMEOVER = 'gameover'
}

/**
 * 单人游戏场景主编排器
 *
 * 负责:
 * - 初始化 GameManager（不连接 SocketClient）
 * - 启用 BattleSystem 本地模式
 * - 管理游戏阶段流转
 * - 接收画板提交事件，注册玩家鱼
 * - 触发 AISpawner 计数
 * - 本地投票处理
 * - 胜负判定
 */
@ccclass('MultiPlayerController')
export class MultiPlayerController extends Component {

    // ==================== 场景节点引用 ====================

    @property(Node)
    drawingPhaseUI: Node = null!;

    @property(Node)
    gamePhaseUI: Node = null!;

    @property(Node)
    drawingBoardNode: Node = null!;

    @property(Node)
    nameInputNode: Node = null!;

    @property(Node)
    descInputNode: Node = null!;

    @property(Node)
    submitButton: Node | Button = null!;

    @property(Node)
    startGameButton: Node | Button = null!;

    @property(Node)
    drawMoreButton: Node | Button = null!;

    @property(Node)
    backButton: Node | Button = null!;

    @property(Node)
    killFeedNode: Node = null!;

    // ==================== 状态 ====================

    private _phase: MultiPlayerPhase = MultiPlayerPhase.DRAWING;
    private _playerFishCount: number = 0;
    private _humanKilledCount: number = 0;
    private _aiKilledCount: number = 0;
    private _localVotes: Map<string, number> = new Map();
    private _ownedFishIds: Set<string> = new Set();
    private _deadOwnedFishIds: Set<string> = new Set();
    private _hasGameStarted: boolean = false;
    private _isDrawingFromGamePhase: boolean = false;
    private _drawPanelNodes: Node[] = [];
    private _isDrawPanelVisible: boolean = true;
    private _processedDrawingCommitTokens: Set<string> = new Set();

    private _aiSpawner: AISpawner | null = null;
    private _killFeedManager: KillFeedManager | null = null;

    private _loadingOverlay: Node | null = null;
    private _loadingTipLabel: Label | null = null;
    private _loadingProgressLabel: Label | null = null;
    private _loadingProgressBar: ProgressBar | null = null;
    private _loadingDuration: number = 0;
    private _loadingElapsed: number = 0;

    // ==================== 生命周期 ====================

    onLoad() {
        this.initGameManager();
        this.initBattleSystem();
        this.initAISpawner();
        this.initKillFeed();
        this.bindButtons();
        this.setupBasicUI();
        this.setPhase(MultiPlayerPhase.DRAWING);
    }

    start() {
        // 监听画板提交事件
        if (this.drawingBoardNode) {
            this.drawingBoardNode.on('drawing-completed', this.onDrawingCompleted, this);
        }

        // 监听淘汰事件
        const gm = GameManager.instance;
        if (gm) {
            gm.events.on(GameManager.EVENT.ELIMINATION_TRIGGERED, this.onElimination, this);
        }
    }

    // ==================== 初始化 ====================

    private initGameManager(): void {
        const gm = GameManager.instance;
        if (!gm) {
            ccError('[MultiPlayerController] GameManager not found');
            return;
        }

        gm.resetGame();
        this._processedDrawingCommitTokens.clear();
        gm.setPlayerId('local-player');
        gm.setEliminationThreshold(BATTLE_CONSTANTS.ELIMINATION_THRESHOLD);
        gm.setPhase(GamePhase.DRAWING);
    }

    private initBattleSystem(): void {
        const bs = BattleSystem.instance;
        if (!bs) {
            ccError('[MultiPlayerController] BattleSystem not found');
            return;
        }

        const callbacks: LocalBattleCallbacks = {
            onVote: (fishId: string) => this.handleLocalVote(fishId),
            onChase: (fishId: string) => this.handleLocalChase(fishId),
            onSwitchTarget: (oldId: string, newId: string) => this.handleLocalSwitch(oldId, newId),
            onRetractVote: (fishId: string) => this.handleLocalRetract(fishId),
        };

        bs.enableLocalMode(callbacks);
    }

    private initAISpawner(): void {
        this._aiSpawner = this.node.getComponent(AISpawner);
        if (!this._aiSpawner) {
            this._aiSpawner = this.node.addComponent(AISpawner);
        }
    }

    private initKillFeed(): void {
        if (this.killFeedNode) {
            this._killFeedManager = this.killFeedNode.getComponent(KillFeedManager);
            if (!this._killFeedManager) {
                this._killFeedManager = this.killFeedNode.addComponent(KillFeedManager);
            }
        }
    }

    private getButtonComponent(node: Node | null, fieldName: string): Button | null {
        if (!node) return null;
        const button = node.getComponent(Button);
        if (!button) {
            ccWarn(`[MultiPlayerController] ${fieldName} 未绑定 Button 组件: ${node.name}`);
        }
        return button;
    }

    private resolveButtonNode(target: Node | Button | null, fieldName: string, warnOnInvalid: boolean = true): Node | null {
        if (!target) return null;
        if (target instanceof Node) {
            if (target.isValid) {
                return target;
            }
            return null;
        }

        const button = target as Button;
        const componentNode = button.node;
        if (button.isValid && componentNode?.isValid) {
            return componentNode;
        }

        if (warnOnInvalid && button.isValid) {
            ccWarn(`[MultiPlayerController] ${fieldName} 不是有效的 Node/Button 引用`);
        }
        return null;
    }

    private bindButtons(): void {
        this.resolveButtonNode(this.submitButton, 'submitButton')?.on(Button.EventType.CLICK, this.onSubmitFish, this);
        this.resolveButtonNode(this.startGameButton, 'startGameButton')?.on(Button.EventType.CLICK, this.onStartGame, this);
        this.resolveButtonNode(this.drawMoreButton, 'drawMoreButton')?.on(Button.EventType.CLICK, this.onDrawMore, this);
        this.resolveButtonNode(this.backButton, 'backButton')?.on(Button.EventType.CLICK, this.onBack, this);
    }

    private setupBasicUI(): void {
        this.setupTitleAndHints();
        this.setupQuickActions();
        this.cacheDrawPanelNodes();
        this.setupLoadingOverlay();
        this.updateDrawMoreButtonState();
        this.setDrawPanelVisible(false, false);
    }

    private setupTitleAndHints(): void {
        const titleNode = this.drawingPhaseUI?.getChildByName('Title');
        const titleLabel = titleNode?.getComponent(Label);
        if (titleLabel) {
            titleLabel.string = '反方向的图灵';
            titleLabel.fontSize = 40;
        }

        if (!titleNode) return;

        const subtitle = this.ensureChildLabel(
            titleNode,
            'RuleSubtitle',
            '通过投票找出 AI 生成的间谍，你也可以涂鸦出属于自己的鱼！',
            18,
            new Vec3(0, -42, 0),
            new Color(255, 236, 170, 255),
        );
        subtitle.overflow = Label.Overflow.SHRINK;

        this.ensureChildLabel(
            titleNode,
            'HintLeft',
            '🗳️ 投票驱逐 AI',
            20,
            new Vec3(-220, -4, 0),
            new Color(255, 219, 253, 255),
        );

        this.ensureChildLabel(
            titleNode,
            'HintRight',
            '🐟 鱼人杀',
            20,
            new Vec3(200, -4, 0),
            new Color(198, 242, 255, 255),
        );
    }

    private setupQuickActions(): void {
        if (!this.drawingPhaseUI) return;

        const quickFillBtn = this.ensureTextButton(
            this.drawingPhaseUI,
            'QuickFillButton',
            '一键填写',
            new Vec3(-120, -310, 0),
            new Color(124, 190, 255, 255),
        );

        const skipBtn = this.ensureTextButton(
            this.drawingPhaseUI,
            'SkipMetaButton',
            '跳过填写',
            new Vec3(120, -310, 0),
            new Color(168, 168, 168, 255),
        );

        quickFillBtn.node.off(Button.EventType.CLICK, this.onQuickFillClick, this);
        quickFillBtn.node.on(Button.EventType.CLICK, this.onQuickFillClick, this);

        skipBtn.node.off(Button.EventType.CLICK, this.onSkipMetaClick, this);
        skipBtn.node.on(Button.EventType.CLICK, this.onSkipMetaClick, this);
    }

    private cacheDrawPanelNodes(): void {
        const nodes: Node[] = [];
        const pushUniqueNode = (node: Node | null | undefined) => {
            if (!node || !node.isValid) return;
            if (!nodes.includes(node)) {
                nodes.push(node);
            }
        };

        pushUniqueNode(this.drawingBoardNode);
        pushUniqueNode(this.nameInputNode);
        pushUniqueNode(this.descInputNode);
        const submitButtonNode = this.resolveButtonNode(this.submitButton, 'submitButton');
        const startGameButtonNode = this.resolveButtonNode(this.startGameButton, 'startGameButton');
        pushUniqueNode(submitButtonNode);
        pushUniqueNode(startGameButtonNode);

        const drawingBoardComp = this.drawingBoardNode?.getComponent('DrawingBoard') as any;
        pushUniqueNode(drawingBoardComp?.drawModeButton?.node);
        pushUniqueNode(drawingBoardComp?.eraserModeButton?.node);
        (drawingBoardComp?.colorButtons ?? []).forEach((btn: any) => pushUniqueNode(btn?.node));

        if (this.drawingPhaseUI) {
            const quickFill = this.drawingPhaseUI.getChildByName('QuickFillButton');
            const skip = this.drawingPhaseUI.getChildByName('SkipMetaButton');
            pushUniqueNode(quickFill);
            pushUniqueNode(skip);
        }

        this._drawPanelNodes = nodes;
    }

    private setupLoadingOverlay(): void {
        if (!this.gamePhaseUI) return;

        const existing = this.gamePhaseUI.getChildByName('SyncLoadingOverlay');
        if (existing) {
            this._loadingOverlay = existing;
            this._loadingTipLabel = existing.getChildByName('TipLabel')?.getComponent(Label) || null;
            this._loadingProgressLabel = existing.getChildByName('ProgressLabel')?.getComponent(Label) || null;
            this._loadingProgressBar = existing.getChildByName('ProgressBar')?.getComponent(ProgressBar) || null;
            return;
        }

        const overlay = new Node('SyncLoadingOverlay');
        this.gamePhaseUI.addChild(overlay);

        const overlayTransform = overlay.addComponent(UITransform);
        overlayTransform.setContentSize(750, 1334);
        overlay.setPosition(0, 0, 999);

        const overlayBg = overlay.addComponent(Sprite);
        overlayBg.color = new Color(20, 24, 42, 220);

        overlay.addComponent(UIOpacity).opacity = 0;

        const title = this.createLabelNode(
            overlay,
            'LoadingTitle',
            '🐠 正在同步鱼缸',
            34,
            new Vec3(0, 120, 0),
            new Color(255, 255, 255, 255),
        );
        title.horizontalAlign = Label.HorizontalAlign.CENTER;

        const tip = this.createLabelNode(
            overlay,
            'TipLabel',
            LOADING_TIPS[0],
            24,
            new Vec3(0, 40, 0),
            new Color(211, 230, 255, 255),
        );
        tip.horizontalAlign = Label.HorizontalAlign.CENTER;
        tip.overflow = Label.Overflow.SHRINK;

        const progressBarNode = new Node('ProgressBar');
        overlay.addChild(progressBarNode);
        const pbTransform = progressBarNode.addComponent(UITransform);
        pbTransform.setContentSize(380, 22);
        progressBarNode.setPosition(0, -20, 0);

        const progressBgSprite = progressBarNode.addComponent(Sprite);
        progressBgSprite.color = new Color(70, 80, 120, 255);

        const barNode = new Node('Bar');
        progressBarNode.addChild(barNode);
        const barTransform = barNode.addComponent(UITransform);
        barTransform.setContentSize(380, 22);
        const barSprite = barNode.addComponent(Sprite);
        barSprite.color = new Color(110, 220, 255, 255);

        const progressBar = progressBarNode.addComponent(ProgressBar);
        progressBar.mode = ProgressBar.Mode.HORIZONTAL;
        progressBar.barSprite = barSprite;
        progressBar.totalLength = 380;
        progressBar.progress = 0;

        const progressLabel = this.createLabelNode(
            overlay,
            'ProgressLabel',
            '0%',
            22,
            new Vec3(0, -60, 0),
            new Color(255, 255, 255, 255),
        );
        progressLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

        overlay.active = false;
        this._loadingOverlay = overlay;
        this._loadingTipLabel = tip;
        this._loadingProgressLabel = progressLabel;
        this._loadingProgressBar = progressBar;
    }

    // ==================== 阶段管理 ====================

    private setPhase(phase: MultiPlayerPhase): void {
        this._phase = phase;
        const gm = GameManager.instance;

        switch (phase) {
            case MultiPlayerPhase.DRAWING:
                if (gm) gm.setPhase(GamePhase.DRAWING);
                this.setUINodeVisibility(this.drawingPhaseUI, true);
                this.setUINodeVisibility(this.gamePhaseUI, false);
                this.setDrawPanelVisible(false, false);
                this.hideLoadingOverlay(true);
                break;

            case MultiPlayerPhase.VIEWING:
                if (gm) gm.setPhase(GamePhase.VIEWING);
                this.setUINodeVisibility(this.drawingPhaseUI, false);
                this.setUINodeVisibility(this.gamePhaseUI, true);
                this.updateDrawPanelToggleState();

                // 审核/同步加载态（基础UI版）
                this.showLoadingOverlay(2.4);
                this.scheduleOnce(() => {
                    this.hideLoadingOverlay();
                    this.setPhase(MultiPlayerPhase.VOTING);
                }, 2.4);
                break;

            case MultiPlayerPhase.VOTING:
                if (gm) gm.setPhase(GamePhase.VOTING);
                this.updateDrawPanelToggleState();
                gm?.showToast(ToastType.INFO, '投票阶段开始！点击鱼并选择“就是它！”');
                break;

            case MultiPlayerPhase.GAMEOVER:
                if (gm) gm.setPhase(GamePhase.GAMEOVER);
                this.setUINodeVisibility(this.gamePhaseUI, true);
                this.updateDrawPanelToggleState();
                this.hideLoadingOverlay(true);
                break;
        }
    }

    // ==================== 画板事件 ====================

    private onDrawingCompleted(spriteFrame: SpriteFrame, commitToken?: string): void {
        if (this._phase !== MultiPlayerPhase.DRAWING) return;

        const gm = GameManager.instance;
        if (!gm) return;

        if (!spriteFrame || !spriteFrame.texture) {
            gm.showToast(ToastType.ERROR, '保存失败，请重试');
            return;
        }

        if (commitToken) {
            if (this._processedDrawingCommitTokens.has(commitToken)) {
                ccWarn(`[MultiPlayerController] 忽略重复提交 token=${commitToken}`);
                return;
            }
            this._processedDrawingCommitTokens.add(commitToken);
            // 仅保留近期 token，避免集合无上限增长
            if (this._processedDrawingCommitTokens.size > 200) {
                const oldest = this._processedDrawingCommitTokens.values().next().value as string | undefined;
                if (oldest) {
                    this._processedDrawingCommitTokens.delete(oldest);
                }
            }
        }

        if (this._ownedFishIds.size >= MAX_ACTIVE_FISH) {
            gm.showToast(ToastType.WARNING, '你的鱼缸太挤了，等死一条再说吧');
            this.updateDrawMoreButtonState();
            return;
        }

        const nameLabel = this.nameInputNode?.getComponent(Label);
        const descLabel = this.descInputNode?.getComponent(Label);

        const { fishName, fishDesc } = this.normalizeFishMeta(
            nameLabel?.string || '',
            descLabel?.string || '',
        );

        if (nameLabel) nameLabel.string = fishName;
        if (descLabel) descLabel.string = fishDesc;

        const fishId = `player-fish-${Date.now()}`;
        try {
            gm.setLocalFishSpriteFrame(fishId, spriteFrame);
            gm.addItem({
                id: fishId,
                name: fishName,
                description: fishDesc,
                imageUrl: `${LOCAL_SPRITE_PREFIX}${fishId}`,
                author: '玩家',
                isAI: false,
            });
        } catch (error) {
            ccError('[MultiPlayerController] 鱼保存/入池失败:', error);
            gm.showToast(ToastType.ERROR, '保存失败，请稍后重试');
            return;
        }

        if (this._ownedFishIds.size === 0) {
            gm.setPlayerFishId(fishId);
        }

        this._ownedFishIds.add(fishId);
        this._playerFishCount = this._ownedFishIds.size;

        if (this._aiSpawner) {
            this._aiSpawner.onHumanFishCreated();
        }

        gm.showToast(ToastType.SUCCESS, '投放成功！');

        const startGameButtonNode = this.resolveButtonNode(this.startGameButton, 'startGameButton');
        if (startGameButtonNode) {
            startGameButtonNode.active = true;
        }

        this.updateDrawMoreButtonState();

        if (this._isDrawingFromGamePhase) {
            this._isDrawingFromGamePhase = false;
            this.setPhase(MultiPlayerPhase.VOTING);
            return;
        }

        this.setDrawPanelVisible(false, true);
    }

    private onSubmitFish(): void {
        if (this.drawingBoardNode) {
            const drawingBoard = this.drawingBoardNode.getComponent('DrawingBoard') as any;
            if (drawingBoard && drawingBoard.onSubmit) {
                drawingBoard.onSubmit();
            }
        }
    }

    // ==================== 按钮事件 ====================

    private onQuickFillClick(): void {
        const nameLabel = this.nameInputNode?.getComponent(Label);
        const descLabel = this.descInputNode?.getComponent(Label);
        if (nameLabel) {
            nameLabel.string = this.pickRandom(AUTO_FISH_NAMES).slice(0, 8);
        }
        if (descLabel) {
            descLabel.string = this.pickRandom(AUTO_FISH_DESC).slice(0, 20);
        }
        GameManager.instance?.showToast(ToastType.INFO, '已帮你快速填写');
    }

    private onSkipMetaClick(): void {
        const nameLabel = this.nameInputNode?.getComponent(Label);
        const descLabel = this.descInputNode?.getComponent(Label);
        if (nameLabel) nameLabel.string = '';
        if (descLabel) descLabel.string = '';
        GameManager.instance?.showToast(ToastType.INFO, '已跳过，提交时将自动补全');
    }

    private onStartGame(): void {
        if (this._ownedFishIds.size === 0) {
            GameManager.instance?.showToast(ToastType.WARNING, '至少画一条鱼才能开始！');
            return;
        }

        if (this._aiSpawner) {
            const aiCount = Math.floor(Math.random() * 3) + 2; // 2-4 条 AI 鱼
            this._aiSpawner.preSpawnAIFish(aiCount);
        }

        this._hasGameStarted = true;
        this.setDrawPanelVisible(false, false);
        this.setPhase(MultiPlayerPhase.VIEWING);
    }

    private onDrawMore(): void {
        this.onDrawPanelToggleClick();
    }

    private onDrawPanelToggleClick(): void {
        if (this._ownedFishIds.size >= MAX_ACTIVE_FISH) {
            GameManager.instance?.showToast(ToastType.WARNING, '你的鱼缸太挤了，等死一条再说吧');
            this.updateDrawMoreButtonState();
            return;
        }

        this._isDrawingFromGamePhase = this._hasGameStarted && this._phase !== MultiPlayerPhase.DRAWING;
        if (this._phase !== MultiPlayerPhase.DRAWING) {
            this.setPhase(MultiPlayerPhase.DRAWING);
        }
        this.setDrawPanelVisible(true, true);
    }

    private onBack(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.resetGame();
        }
        this._hasGameStarted = false;
        this._isDrawingFromGamePhase = false;
        this._isDrawPanelVisible = false;

        const bs = BattleSystem.instance;
        if (bs) {
            bs.disableLocalMode();
        }

        director.loadScene('MainScene');
    }

    // ==================== 本地投票处理 ====================

    private handleLocalVote(fishId: string): void {
        const currentVotes = this._localVotes.get(fishId) || 0;
        const newVotes = currentVotes + 1;
        this._localVotes.set(fishId, newVotes);

        const gm = GameManager.instance;
        if (gm) {
            gm.updateFishVotes(fishId, newVotes, ['local-player']);
        }
    }

    private handleLocalChase(fishId: string): void {
        const currentVotes = this._localVotes.get(fishId) || 0;
        const newVotes = currentVotes + 1;
        this._localVotes.set(fishId, newVotes);

        const gm = GameManager.instance;
        if (gm) {
            gm.updateFishVotes(fishId, newVotes, ['local-player']);
        }
    }

    private handleLocalSwitch(oldFishId: string, newFishId: string): void {
        const oldVotes = this._localVotes.get(oldFishId) || 0;
        if (oldVotes > 0) {
            this._localVotes.set(oldFishId, oldVotes - 1);
            const gm = GameManager.instance;
            if (gm) {
                gm.updateFishVotes(oldFishId, oldVotes - 1, []);
            }
        }

        const newVotes = (this._localVotes.get(newFishId) || 0) + 1;
        this._localVotes.set(newFishId, newVotes);

        const gm = GameManager.instance;
        if (gm) {
            gm.updateFishVotes(newFishId, newVotes, ['local-player']);
        }
    }

    private handleLocalRetract(fishId: string): void {
        const currentVotes = this._localVotes.get(fishId) || 0;
        if (currentVotes > 0) {
            this._localVotes.set(fishId, currentVotes - 1);
            const gm = GameManager.instance;
            if (gm) {
                gm.updateFishVotes(fishId, currentVotes - 1, []);
            }
        }
    }

    // ==================== 淘汰处理 ====================

    private onElimination(data: EliminationData): void {
        const gm = GameManager.instance;
        if (!gm) return;

        if (this._killFeedManager) {
            this._killFeedManager.showKillFeed(data.fishName, data.isAI);
        }

        if (data.isAI) {
            this._aiKilledCount++;
        } else {
            this._humanKilledCount++;
        }

        if (this._ownedFishIds.has(data.fishId)) {
            this._deadOwnedFishIds.add(data.fishId);
            gm.showToast(ToastType.WARNING, `痛心！你的「${data.fishName}」被当成 AI 抓走了！`);

            // 尸体保留30秒后释放名额
            this.scheduleOnce(() => {
                this._ownedFishIds.delete(data.fishId);
                this._deadOwnedFishIds.delete(data.fishId);
                this._playerFishCount = this._ownedFishIds.size;
                this.updateDrawMoreButtonState();
            }, CORPSE_HOLD_SECONDS);
        }

        gm.removeItem(data.fishId);
        this._localVotes.delete(data.fishId);

        this.scheduleOnce(() => {
            this.checkGameEnd();
        }, 0.5);
    }

    // ==================== 胜负判定 ====================

    private checkGameEnd(): void {
        const gm = GameManager.instance;
        if (!gm || this._phase === MultiPlayerPhase.GAMEOVER) return;

        const items = gm.items;
        const aiCount = items.filter(i => i.isAI).length;
        const humanCount = items.filter(i => !i.isAI).length;

        // 胜利: AI 全灭 + 人类 >= 5
        if (aiCount === 0 && humanCount >= BATTLE_CONSTANTS.VICTORY_MIN_HUMAN_COUNT) {
            this.setPhase(MultiPlayerPhase.GAMEOVER);
            gm.setGameResult({
                isVictory: true,
                aiRemaining: 0,
                humanRemaining: humanCount,
                mvpPlayerName: '玩家',
            });
            return;
        }

        // 失败: AI 数量超过阈值
        if (aiCount > BATTLE_CONSTANTS.DEFEAT_MAX_AI_COUNT) {
            this.setPhase(MultiPlayerPhase.GAMEOVER);
            gm.setGameResult({
                isVictory: false,
                aiRemaining: aiCount,
                humanRemaining: humanCount,
                reason: 'ai_majority',
            });
            return;
        }

        // 失败: 误杀人类 >= 3
        if (this._humanKilledCount >= BATTLE_CONSTANTS.MAX_HUMAN_KILLED) {
            this.setPhase(MultiPlayerPhase.GAMEOVER);
            gm.setGameResult({
                isVictory: false,
                aiRemaining: aiCount,
                humanRemaining: humanCount,
                humanKilled: this._humanKilledCount,
                reason: 'too_many_human_killed',
            });
            return;
        }
    }

    // ==================== UI 帮助方法 ====================

    private normalizeFishMeta(rawName: string, rawDesc: string): { fishName: string; fishDesc: string } {
        const cleanName = this.sanitizeText(rawName, 8);
        const cleanDesc = this.sanitizeText(rawDesc, 20);

        const fishName = cleanName || this.pickRandom(AUTO_FISH_NAMES).slice(0, 8);
        const fishDesc = cleanDesc || this.pickRandom(AUTO_FISH_DESC).slice(0, 20);

        return { fishName, fishDesc };
    }

    private sanitizeText(text: string, maxLen: number): string {
        const trimmed = text.trim();
        if (!trimmed) return '';

        // 兼容场景里的占位文本
        if (trimmed.includes('起个名字') || trimmed.includes('描述一下')) {
            return '';
        }

        return Array.from(trimmed).slice(0, maxLen).join('');
    }

    private updateDrawMoreButtonState(): void {
        const drawMoreButtonNode = this.resolveButtonNode(this.drawMoreButton, 'drawMoreButton');
        if (!drawMoreButtonNode) return;

        const activeCount = this._ownedFishIds.size;
        const available = activeCount < MAX_ACTIVE_FISH;
        const drawMoreButton = this.getButtonComponent(drawMoreButtonNode, 'drawMoreButton');

        if (drawMoreButton) {
            drawMoreButton.interactable = available;
        }
        this.updateDrawPanelToggleState();
    }

    private setDrawPanelVisible(visible: boolean, animate: boolean): void {
        this._isDrawPanelVisible = visible;

        this._drawPanelNodes.forEach((node) => {
            if (!node || !node.isValid) return;
            if (!animate) {
                node.active = visible;
                return;
            }

            node.active = true;
            const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
            opacity.opacity = visible ? 0 : 255;
            tween(opacity)
                .to(0.15, { opacity: visible ? 255 : 0 })
                .call(() => {
                    node.active = visible;
                })
                .start();
        });

        const startGameButtonNode = this.resolveButtonNode(this.startGameButton, 'startGameButton');
        if (visible && startGameButtonNode) {
            startGameButtonNode.active = this._ownedFishIds.size > 0;
        }

        this.updateDrawPanelToggleState();
    }

    private updateDrawPanelToggleState(): void {
        const node = this.resolveButtonNode(this.drawMoreButton, 'drawMoreButton');
        if (!node) return;

        const activeCount = this._ownedFishIds.size;
        const available = activeCount < MAX_ACTIVE_FISH;
        const canShow = this._phase !== MultiPlayerPhase.GAMEOVER;
        const drawMoreButton = this.getButtonComponent(node, 'drawMoreButton');
        node.active = canShow;

        if (drawMoreButton) {
            drawMoreButton.interactable = available;
        }

        const label = node.getChildByName('Label')?.getComponent(Label);
        if (label) {
            label.string = available
                ? `画一条鱼 (${activeCount}/${MAX_ACTIVE_FISH})`
                : `鱼缸太挤了 (${activeCount}/${MAX_ACTIVE_FISH})`;
        }

        const bg = node.getComponent(Sprite);
        if (bg) {
            bg.color = available ? new Color(249, 137, 74, 255) : new Color(130, 130, 130, 255);
        }
    }


    private showLoadingOverlay(duration: number): void {
        if (!this._loadingOverlay) return;

        this._loadingDuration = Math.max(0.5, duration);
        this._loadingElapsed = 0;

        this._loadingOverlay.active = true;
        const opacity = this._loadingOverlay.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = 0;
            tween(opacity).to(0.18, { opacity: 255 }).start();
        }

        this.refreshLoadingTip();
        this.updateLoadingProgress();

        this.unschedule(this.refreshLoadingTip);
        this.unschedule(this.updateLoadingProgress);

        this.schedule(this.refreshLoadingTip, 0.6);
        this.schedule(this.updateLoadingProgress, 0.1);
    }

    private hideLoadingOverlay(immediate: boolean = false): void {
        if (!this._loadingOverlay || !this._loadingOverlay.active) return;

        this.unschedule(this.refreshLoadingTip);
        this.unschedule(this.updateLoadingProgress);

        if (immediate) {
            this._loadingOverlay.active = false;
            return;
        }

        const opacity = this._loadingOverlay.getComponent(UIOpacity);
        if (!opacity) {
            this._loadingOverlay.active = false;
            return;
        }

        tween(opacity)
            .to(0.15, { opacity: 0 })
            .call(() => {
                if (this._loadingOverlay) {
                    this._loadingOverlay.active = false;
                }
            })
            .start();
    }

    private refreshLoadingTip(): void {
        if (this._loadingTipLabel) {
            this._loadingTipLabel.string = this.pickRandom(LOADING_TIPS);
        }
    }

    private updateLoadingProgress(): void {
        this._loadingElapsed = Math.min(this._loadingDuration, this._loadingElapsed + 0.1);
        const progress = this._loadingDuration <= 0 ? 1 : this._loadingElapsed / this._loadingDuration;

        if (this._loadingProgressBar) {
            this._loadingProgressBar.progress = progress;
        }
        if (this._loadingProgressLabel) {
            this._loadingProgressLabel.string = `${Math.floor(progress * 100)}%`;
        }
    }

    private ensureChildLabel(
        parent: Node,
        name: string,
        text: string,
        fontSize: number,
        position: Vec3,
        color: Color,
    ): Label {
        const existing = parent.getChildByName(name);
        if (existing) {
            const label = existing.getComponent(Label) || existing.addComponent(Label);
            label.string = text;
            label.fontSize = fontSize;
            label.color = color;
            existing.setPosition(position);
            return label;
        }

        return this.createLabelNode(parent, name, text, fontSize, position, color);
    }

    private createLabelNode(
        parent: Node,
        name: string,
        text: string,
        fontSize: number,
        position: Vec3,
        color: Color,
    ): Label {
        const node = new Node(name);
        parent.addChild(node);
        node.setPosition(position);

        const transform = node.addComponent(UITransform);
        transform.setContentSize(560, 48);

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.max(30, fontSize + 8);
        label.color = color;

        return label;
    }

    private ensureTextButton(
        parent: Node,
        name: string,
        text: string,
        position: Vec3,
        bgColor: Color,
    ): Button {
        let buttonNode = parent.getChildByName(name);
        if (!buttonNode) {
            buttonNode = new Node(name);
            parent.addChild(buttonNode);
            buttonNode.setPosition(position);

            const bg = buttonNode.addComponent(Sprite);
            bg.color = bgColor;

            const labelNode = new Node('Label');
            buttonNode.addChild(labelNode);
            labelNode.setPosition(0, 0, 0);
            const lt = labelNode.addComponent(UITransform);
            lt.setContentSize(160, 50);
            const lbl = labelNode.addComponent(Label);
            lbl.string = text;
            lbl.fontSize = 22;
            lbl.color = Color.WHITE;
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            lbl.verticalAlign = Label.VerticalAlign.CENTER;
        } else {
            buttonNode.setPosition(position);
            const label = buttonNode.getChildByName('Label')?.getComponent(Label);
            if (label) label.string = text;
            const bg = buttonNode.getComponent(Sprite);
            if (bg) bg.color = bgColor;
        }

        return buttonNode.getComponent(Button) || buttonNode.addComponent(Button);
    }

    private setUINodeVisibility(node: Node | null, visible: boolean): void {
        if (!node) return;
        node.active = visible;

        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = visible ? 255 : 0;
        }
    }

    private pickRandom<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    private safeNodeOff(node: Node | null, eventType: string, handler: (...args: unknown[]) => void): void {
        if (!node || !node.isValid) {
            return;
        }

        try {
            node.off(eventType, handler, this);
        } catch (error) {
            ccWarn(`[MultiPlayerController] 跳过事件解绑: ${eventType}`, error);
        }
    }

    // ==================== 清理 ====================

    onDestroy(): void {
        this.safeNodeOff(this.drawingBoardNode, 'drawing-completed', this.onDrawingCompleted);

        const submitButtonNode = this.resolveButtonNode(this.submitButton, 'submitButton', false);
        const startGameButtonNode = this.resolveButtonNode(this.startGameButton, 'startGameButton', false);
        const drawMoreButtonNode = this.resolveButtonNode(this.drawMoreButton, 'drawMoreButton', false);
        const backButtonNode = this.resolveButtonNode(this.backButton, 'backButton', false);

        this.safeNodeOff(submitButtonNode, Button.EventType.CLICK, this.onSubmitFish);
        this.safeNodeOff(startGameButtonNode, Button.EventType.CLICK, this.onStartGame);
        this.safeNodeOff(drawMoreButtonNode, Button.EventType.CLICK, this.onDrawMore);
        this.safeNodeOff(backButtonNode, Button.EventType.CLICK, this.onBack);

        const drawingPhaseUiNode = this.drawingPhaseUI;
        if (drawingPhaseUiNode && drawingPhaseUiNode.isValid) {
            const quickFill = drawingPhaseUiNode.getChildByName('QuickFillButton');
            const skip = drawingPhaseUiNode.getChildByName('SkipMetaButton');
            this.safeNodeOff(quickFill, Button.EventType.CLICK, this.onQuickFillClick);
            this.safeNodeOff(skip, Button.EventType.CLICK, this.onSkipMetaClick);
        }

        this.unschedule(this.refreshLoadingTip);
        this.unschedule(this.updateLoadingProgress);

        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.ELIMINATION_TRIGGERED, this.onElimination, this);
        }

        const bs = BattleSystem.instance;
        if (bs) {
            bs.disableLocalMode();
        }
    }
}
