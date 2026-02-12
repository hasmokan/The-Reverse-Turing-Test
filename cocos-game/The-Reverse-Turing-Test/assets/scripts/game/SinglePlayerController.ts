import {
    _decorator, Component, Node, Label, Button,
    SpriteFrame, director
} from 'cc';
import { GameManager } from '../core/GameManager';
import { BattleSystem, LocalBattleCallbacks } from './BattleSystem';
import { AISpawner } from './AISpawner';
import { KillFeedManager } from '../ui/KillFeedManager';
import { GamePhase, EliminationData, ToastType } from '../data/GameTypes';
import { BATTLE_CONSTANTS } from '../data/GameConstants';

const { ccclass, property } = _decorator;

/**
 * 单人游戏阶段
 */
enum SinglePlayerPhase {
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
@ccclass('SinglePlayerController')
export class SinglePlayerController extends Component {

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

    @property(Button)
    submitButton: Button = null!;

    @property(Button)
    startGameButton: Button = null!;

    @property(Button)
    drawMoreButton: Button = null!;

    @property(Button)
    backButton: Button = null!;

    @property(Node)
    killFeedNode: Node = null!;

    // ==================== 状态 ====================

    private _phase: SinglePlayerPhase = SinglePlayerPhase.DRAWING;
    private _playerFishCount: number = 0;
    private _humanKilledCount: number = 0;
    private _aiKilledCount: number = 0;
    private _localVotes: Map<string, number> = new Map();
    private _aiSpawner: AISpawner | null = null;
    private _killFeedManager: KillFeedManager | null = null;

    // ==================== 生命周期 ====================

    onLoad() {
        this.initGameManager();
        this.initBattleSystem();
        this.initAISpawner();
        this.initKillFeed();
        this.bindButtons();
        this.setPhase(SinglePlayerPhase.DRAWING);
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
            console.error('[SinglePlayerController] GameManager not found');
            return;
        }

        gm.resetGame();
        gm.setPlayerId('local-player');
        // 单人模式淘汰阈值设为1（方便测试）
        gm.setEliminationThreshold(1);
        gm.setPhase(GamePhase.DRAWING);
    }

    private initBattleSystem(): void {
        const bs = BattleSystem.instance;
        if (!bs) {
            console.error('[SinglePlayerController] BattleSystem not found');
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

    private bindButtons(): void {
        if (this.submitButton) {
            this.submitButton.node.on(Button.EventType.CLICK, this.onSubmitFish, this);
        }
        if (this.startGameButton) {
            this.startGameButton.node.on(Button.EventType.CLICK, this.onStartGame, this);
        }
        if (this.drawMoreButton) {
            this.drawMoreButton.node.on(Button.EventType.CLICK, this.onDrawMore, this);
        }
        if (this.backButton) {
            this.backButton.node.on(Button.EventType.CLICK, this.onBack, this);
        }
    }

    // ==================== 阶段管理 ====================

    private setPhase(phase: SinglePlayerPhase): void {
        this._phase = phase;
        const gm = GameManager.instance;

        switch (phase) {
            case SinglePlayerPhase.DRAWING:
                if (gm) gm.setPhase(GamePhase.DRAWING);
                if (this.drawingPhaseUI) this.drawingPhaseUI.active = true;
                if (this.gamePhaseUI) this.gamePhaseUI.active = false;
                if (this.startGameButton) {
                    this.startGameButton.node.active = this._playerFishCount > 0;
                }
                break;

            case SinglePlayerPhase.VIEWING:
                if (gm) gm.setPhase(GamePhase.VIEWING);
                if (this.drawingPhaseUI) this.drawingPhaseUI.active = false;
                if (this.gamePhaseUI) this.gamePhaseUI.active = true;
                // 短暂观察期后进入投票
                this.scheduleOnce(() => {
                    this.setPhase(SinglePlayerPhase.VOTING);
                }, 2);
                break;

            case SinglePlayerPhase.VOTING:
                if (gm) gm.setPhase(GamePhase.VOTING);
                gm?.showToast(ToastType.INFO, '投票阶段开始！找出AI鱼并投票淘汰它们');
                break;

            case SinglePlayerPhase.GAMEOVER:
                if (gm) gm.setPhase(GamePhase.GAMEOVER);
                break;
        }
    }

    // ==================== 画板事件 ====================

    private onDrawingCompleted(spriteFrame: SpriteFrame): void {
        if (this._phase !== SinglePlayerPhase.DRAWING) return;

        const gm = GameManager.instance;
        if (!gm) return;

        // 获取名称和描述
        const nameLabel = this.nameInputNode?.getComponent(Label);
        const descLabel = this.descInputNode?.getComponent(Label);
        const fishName = nameLabel?.string || `我的鱼${this._playerFishCount + 1}`;
        const fishDesc = descLabel?.string || '一条手绘的鱼~';

        // 注册玩家鱼到 GameManager
        const fishId = `player-fish-${Date.now()}`;
        gm.addItem({
            id: fishId,
            name: fishName,
            description: fishDesc,
            imageUrl: '', // spriteFrame 通过事件传递
            author: '玩家',
            isAI: false,
        });

        // 设置玩家鱼ID（第一条）
        if (this._playerFishCount === 0) {
            gm.setPlayerFishId(fishId);
        }

        this._playerFishCount++;

        // 触发 AISpawner 计数
        if (this._aiSpawner) {
            this._aiSpawner.onHumanFishCreated();
        }

        gm.showToast(ToastType.SUCCESS, `鱼「${fishName}」已加入鱼缸！`);

        // 显示开始游戏按钮
        if (this.startGameButton) {
            this.startGameButton.node.active = true;
        }
    }

    private onSubmitFish(): void {
        // DrawingBoard 的 submit 会触发 drawing-completed 事件
        // 这里作为备用入口
        if (this.drawingBoardNode) {
            const drawingBoard = this.drawingBoardNode.getComponent('DrawingBoard') as any;
            if (drawingBoard && drawingBoard.onSubmit) {
                drawingBoard.onSubmit();
            }
        }
    }

    // ==================== 按钮事件 ====================

    private onStartGame(): void {
        if (this._playerFishCount === 0) {
            GameManager.instance?.showToast(ToastType.WARNING, '至少画一条鱼才能开始！');
            return;
        }

        // 预生成一些AI鱼
        if (this._aiSpawner) {
            const aiCount = Math.floor(Math.random() * 3) + 2; // 2-4条AI鱼
            this._aiSpawner.preSpawnAIFish(aiCount);
        }

        // 进入观察阶段
        this.setPhase(SinglePlayerPhase.VIEWING);
    }

    private onDrawMore(): void {
        this.setPhase(SinglePlayerPhase.DRAWING);
    }

    private onBack(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.resetGame();
        }

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
        // 追击：增加票数
        const currentVotes = this._localVotes.get(fishId) || 0;
        const newVotes = currentVotes + 1;
        this._localVotes.set(fishId, newVotes);

        const gm = GameManager.instance;
        if (gm) {
            gm.updateFishVotes(fishId, newVotes, ['local-player']);
        }
    }

    private handleLocalSwitch(oldFishId: string, newFishId: string): void {
        // 撤回旧票
        const oldVotes = this._localVotes.get(oldFishId) || 0;
        if (oldVotes > 0) {
            this._localVotes.set(oldFishId, oldVotes - 1);
            const gm = GameManager.instance;
            if (gm) {
                gm.updateFishVotes(oldFishId, oldVotes - 1, []);
            }
        }

        // 投新票
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

        // 显示击杀信息
        if (this._killFeedManager) {
            this._killFeedManager.showKillFeed(data.fishName, data.isAI);
        }

        // 统计
        if (data.isAI) {
            this._aiKilledCount++;
        } else {
            this._humanKilledCount++;
        }

        // 移除鱼
        gm.removeItem(data.fishId);
        this._localVotes.delete(data.fishId);

        // 延迟检查胜负
        this.scheduleOnce(() => {
            this.checkGameEnd();
        }, 0.5);
    }

    // ==================== 胜负判定 ====================

    private checkGameEnd(): void {
        const gm = GameManager.instance;
        if (!gm || this._phase === SinglePlayerPhase.GAMEOVER) return;

        const items = gm.items;
        const aiCount = items.filter(i => i.isAI).length;
        const humanCount = items.filter(i => !i.isAI).length;

        // 胜利: AI全灭
        if (aiCount === 0 && this._aiKilledCount > 0) {
            this.setPhase(SinglePlayerPhase.GAMEOVER);
            gm.setGameResult({
                isVictory: true,
                aiRemaining: 0,
                humanRemaining: humanCount,
                mvpPlayerName: '玩家',
            });
            return;
        }

        // 失败: AI数量超过5
        if (aiCount > BATTLE_CONSTANTS.DEFEAT_MAX_AI_COUNT) {
            this.setPhase(SinglePlayerPhase.GAMEOVER);
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
            this.setPhase(SinglePlayerPhase.GAMEOVER);
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

    // ==================== 清理 ====================

    onDestroy(): void {
        if (this.drawingBoardNode) {
            this.drawingBoardNode.off('drawing-completed', this.onDrawingCompleted, this);
        }

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
