import { _decorator, Component } from 'cc';
import { GameManager } from '../core/GameManager';
import { SocketClient } from '../network/SocketClient';
import { GameItem, ToastType } from '../data/GameTypes';
import { BATTLE_CONSTANTS } from '../data/GameConstants';

const { ccclass } = _decorator;

/**
 * 战斗操作类型
 */
export enum BattleActionType {
    VOTE = 'vote',       // 投票
    CHASE = 'chase',     // 追击
    SWITCH = 'switch'    // 换目标
}

/**
 * 战斗系统
 * 迁移自: frontend/src/hooks/useBattleSystem.ts
 *
 * 负责:
 * - 投票/追击/换目标 逻辑
 * - CD 管理
 * - 战斗结果判定
 */
@ccclass('BattleSystem')
export class BattleSystem extends Component {
    private static _instance: BattleSystem = null!;

    public static get instance(): BattleSystem {
        return BattleSystem._instance;
    }

    onLoad() {
        if (BattleSystem._instance && BattleSystem._instance !== this) {
            this.destroy();
            return;
        }
        BattleSystem._instance = this;
    }

    /**
     * 执行战斗操作
     * 自动判断应该执行什么类型的操作
     */
    executeAction(fishId: string): BattleActionType | null {
        const gm = GameManager.instance;
        const bullet = gm.bullet;

        // 检查是否是自己的鱼
        if (fishId === gm.playerFishId) {
            gm.showToast(ToastType.WARNING, '不能攻击自己的鱼！');
            return null;
        }

        // 判断操作类型
        if (bullet.currentTarget === fishId) {
            // 同一目标 -> 追击
            return this.chase(fishId);
        } else if (bullet.currentTarget && bullet.currentTarget !== fishId) {
            // 有目标但不是当前 -> 换目标
            return this.switchTarget(fishId);
        } else {
            // 没有目标 -> 投票
            return this.vote(fishId);
        }
    }

    /**
     * 投票/开火
     */
    vote(fishId: string): BattleActionType | null {
        const gm = GameManager.instance;

        // 检查子弹是否装填好
        if (!gm.bullet.loaded) {
            const remaining = this.getCooldownRemaining();
            gm.showToast(ToastType.INFO, `冷却中... ${(remaining / 1000).toFixed(1)}s`);
            return null;
        }

        // 消耗子弹，开始 CD
        if (!gm.fireBullet(fishId)) {
            return null;
        }

        // 发送投票事件
        SocketClient.instance.castVote(fishId);

        // 添加浮动伤害
        const item = gm.getItem(fishId);
        if (item) {
            gm.addFloatingDamage(fishId, item.position.x, item.position.y, 1);
        }

        gm.showToast(ToastType.VOTE, '开火！');

        return BattleActionType.VOTE;
    }

    /**
     * 追击 - 对同一目标再次攻击
     */
    chase(fishId: string): BattleActionType | null {
        const gm = GameManager.instance;

        // 检查子弹
        if (!gm.bullet.loaded) {
            const remaining = this.getCooldownRemaining();
            gm.showToast(ToastType.INFO, `冷却中... ${(remaining / 1000).toFixed(1)}s`);
            return null;
        }

        // 追击: 重置 CD 但不改变票数
        gm.chaseFire(fishId);

        // 发送追击事件
        SocketClient.instance.chaseVote(fishId);

        // 添加浮动伤害
        const item = gm.getItem(fishId);
        if (item) {
            gm.addFloatingDamage(fishId, item.position.x, item.position.y, 1);
        }

        gm.showToast(ToastType.VOTE, '追击！');

        return BattleActionType.CHASE;
    }

    /**
     * 换目标 - 撤回对旧目标的票，投给新目标
     */
    switchTarget(newFishId: string): BattleActionType | null {
        const gm = GameManager.instance;
        const oldTargetId = gm.bullet.currentTarget;

        if (!oldTargetId) {
            return this.vote(newFishId);
        }

        // 撤回旧目标的票
        SocketClient.instance.retractVote(oldTargetId);

        // 更新目标
        gm.changeTarget(newFishId);

        // 投给新目标
        SocketClient.instance.castVote(newFishId);

        // 添加浮动伤害
        const item = gm.getItem(newFishId);
        if (item) {
            gm.addFloatingDamage(newFishId, item.position.x, item.position.y, 1);
        }

        gm.showToast(ToastType.VOTE, '换目标！');

        return BattleActionType.SWITCH;
    }

    /**
     * 获取 CD 剩余时间 (毫秒)
     */
    getCooldownRemaining(): number {
        const gm = GameManager.instance;
        if (!gm.bullet.cooldownEndTime) return 0;

        const remaining = gm.bullet.cooldownEndTime - Date.now();
        return Math.max(0, remaining);
    }

    /**
     * 获取 CD 进度 (0-1)
     */
    getCooldownProgress(): number {
        return GameManager.instance.getCooldownProgress();
    }

    /**
     * 检查是否可以攻击
     */
    canAttack(): boolean {
        return GameManager.instance.bullet.loaded;
    }

    /**
     * 获取当前目标
     */
    getCurrentTarget(): string | null {
        return GameManager.instance.bullet.currentTarget;
    }

    /**
     * 检查游戏结束条件
     */
    checkGameEnd(): 'victory' | 'defeat' | null {
        const gm = GameManager.instance;
        const items = gm.items;
        const aiCount = gm.aiCount;

        // 计算人类数量
        const humanCount = items.filter(item => !item.isAI).length;

        // 胜利: AI 全部清除 + 人类 >= 5
        if (aiCount === 0 && humanCount >= BATTLE_CONSTANTS.VICTORY_MIN_HUMAN_COUNT) {
            return 'victory';
        }

        // 失败: AI 数量 > 5
        if (aiCount > BATTLE_CONSTANTS.DEFEAT_MAX_AI_COUNT) {
            return 'defeat';
        }

        return null;
    }

    onDestroy() {
        if (BattleSystem._instance === this) {
            BattleSystem._instance = null!;
        }
    }
}
