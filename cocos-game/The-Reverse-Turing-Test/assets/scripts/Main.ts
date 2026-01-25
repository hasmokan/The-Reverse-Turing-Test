import { _decorator, Component, Node, Prefab, director } from 'cc';
import { GameManager } from './core/GameManager';
import { SocketClient } from './network/SocketClient';
import { BattleSystem } from './game/BattleSystem';
import { GameStage } from './game/GameStage';
import { APIService } from './network/APIService';
import { getPlatformAdapter, getSessionId } from './platform/PlatformAdapter';
import { GamePhase, ToastType } from './data/GameTypes';

const { ccclass, property } = _decorator;

/**
 * 游戏主入口
 * 负责初始化所有管理器和启动游戏流程
 */
@ccclass('Main')
export class Main extends Component {
    @property(Node)
    gameManagerNode: Node = null!;

    @property(Node)
    socketClientNode: Node = null!;

    @property(Node)
    battleSystemNode: Node = null!;

    @property(Node)
    gameStageNode: Node = null!;

    // 测试用的房间代码 (后续可以从 UI 输入)
    @property
    testRoomCode: string = '';

    // 测试用的主题 ID
    @property
    testThemeId: string = 'aquarium';

    async start() {
        console.log('[Main] Game starting...');

        // 1. 初始化平台适配器
        const platform = getPlatformAdapter();
        console.log(`[Main] Platform: ${platform.getPlatformName()}`);

        // 2. 确保管理器组件已挂载
        this.ensureManagers();

        // 3. 获取/生成 Session ID
        const sessionId = await getSessionId();
        GameManager.instance.setPlayerId(sessionId);
        console.log(`[Main] Session ID: ${sessionId}`);

        // 4. 绑定全局事件
        this.bindGlobalEvents();

        // 5. 如果有测试配置，自动连接
        if (this.testRoomCode || this.testThemeId) {
            await this.autoConnect();
        }

        console.log('[Main] Game initialized');
    }

    /**
     * 确保管理器组件存在
     */
    private ensureManagers(): void {
        // GameManager
        if (this.gameManagerNode && !this.gameManagerNode.getComponent(GameManager)) {
            this.gameManagerNode.addComponent(GameManager);
        }

        // SocketClient
        if (this.socketClientNode && !this.socketClientNode.getComponent(SocketClient)) {
            this.socketClientNode.addComponent(SocketClient);
        }

        // BattleSystem
        if (this.battleSystemNode && !this.battleSystemNode.getComponent(BattleSystem)) {
            this.battleSystemNode.addComponent(BattleSystem);
        }
    }

    /**
     * 绑定全局事件
     */
    private bindGlobalEvents(): void {
        const gm = GameManager.instance;
        if (!gm) return;

        // 监听游戏阶段变化
        gm.events.on(GameManager.EVENT.PHASE_CHANGED, this.onPhaseChanged, this);

        // 监听同步完成
        gm.events.on(GameManager.EVENT.SYNCED, this.onSynced, this);

        // 监听游戏结果
        gm.events.on(GameManager.EVENT.GAME_RESULT, this.onGameResult, this);

        // 监听鱼点击
        gm.events.on(GameManager.EVENT.FISH_CLICKED, this.onFishClicked, this);
    }

    /**
     * 自动连接 (开发测试用)
     */
    private async autoConnect(): Promise<void> {
        try {
            let roomCode = this.testRoomCode;

            // 如果没有房间代码，通过主题创建/获取房间
            if (!roomCode && this.testThemeId) {
                console.log(`[Main] Getting room for theme: ${this.testThemeId}`);
                const room = await APIService.getOrCreateRoom(this.testThemeId);
                roomCode = room.roomCode;
                console.log(`[Main] Got room: ${roomCode}`);
            }

            if (roomCode) {
                GameManager.instance.setRoomId(roomCode);
                await SocketClient.instance.connect(roomCode);
            }
        } catch (error) {
            console.error('[Main] Auto connect failed:', error);
            GameManager.instance.showToast(ToastType.ERROR, '连接失败，请重试');
        }
    }

    /**
     * 手动加入房间
     */
    async joinRoom(roomCode: string): Promise<boolean> {
        try {
            GameManager.instance.setRoomId(roomCode);
            await SocketClient.instance.connect(roomCode);
            return true;
        } catch (error) {
            console.error('[Main] Join room failed:', error);
            GameManager.instance.showToast(ToastType.ERROR, '加入房间失败');
            return false;
        }
    }

    /**
     * 通过主题加入游戏
     */
    async joinByTheme(themeId: string): Promise<boolean> {
        try {
            const room = await APIService.getOrCreateRoom(themeId);
            return await this.joinRoom(room.roomCode);
        } catch (error) {
            console.error('[Main] Join by theme failed:', error);
            GameManager.instance.showToast(ToastType.ERROR, '创建房间失败');
            return false;
        }
    }

    // ==================== 事件处理 ====================

    private onPhaseChanged(newPhase: GamePhase, oldPhase: GamePhase): void {
        console.log(`[Main] Phase changed: ${oldPhase} -> ${newPhase}`);

        // 根据阶段切换 UI
        switch (newPhase) {
            case GamePhase.VIEWING:
                // 显示游戏主界面
                break;
            case GamePhase.VOTING:
                // 显示投票界面
                break;
            case GamePhase.GAMEOVER:
                // 显示结果界面
                break;
        }
    }

    private onSynced(): void {
        console.log('[Main] State synced');
        GameManager.instance.showToast(ToastType.SUCCESS, '已连接到游戏');
    }

    private onGameResult(result: any): void {
        console.log('[Main] Game result:', result);

        if (result.isVictory) {
            GameManager.instance.showToast(ToastType.SUCCESS, '胜利！所有 AI 已被消灭！');
        } else {
            GameManager.instance.showToast(ToastType.ERROR, '失败... AI 占领了鱼缸');
        }
    }

    private onFishClicked(item: any): void {
        console.log('[Main] Fish clicked:', item.name);

        // 执行战斗操作
        if (BattleSystem.instance) {
            BattleSystem.instance.executeAction(item.id);
        }
    }

    // ==================== 生命周期 ====================

    onDestroy(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.events.off(GameManager.EVENT.PHASE_CHANGED, this.onPhaseChanged, this);
            gm.events.off(GameManager.EVENT.SYNCED, this.onSynced, this);
            gm.events.off(GameManager.EVENT.GAME_RESULT, this.onGameResult, this);
            gm.events.off(GameManager.EVENT.FISH_CLICKED, this.onFishClicked, this);
        }
    }
}
