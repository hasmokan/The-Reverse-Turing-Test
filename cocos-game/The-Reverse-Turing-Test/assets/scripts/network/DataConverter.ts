/**
 * 数据转换器
 * 负责后端数据格式与前端数据格式之间的转换
 * 迁移自: frontend/src/hooks/useWebSocket.ts 中的数据转换逻辑
 */

import {
    GamePhase, GameItem, BackendGameItem, ThemeConfig, Position, Velocity
} from '../data/GameTypes';
import { PHYSICS_CONFIG } from '../data/GameConstants';

export class DataConverter {
    /**
     * 将后端返回的物品数据转换为前端 GameItem 格式
     */
    static convertBackendItem(backendItem: BackendGameItem): GameItem {
        const bounds = PHYSICS_CONFIG.BOUNDS;
        const velocityConfig = PHYSICS_CONFIG.VELOCITY;
        const scaleConfig = PHYSICS_CONFIG.SCALE;
        const rotationConfig = PHYSICS_CONFIG.ROTATION;

        // 随机方向
        const direction = Math.random() > 0.5 ? 1 : -1;

        // 处理位置: 如果后端没有提供或无效，生成随机位置
        let position: Position;
        if (backendItem.position &&
            this.isValidNumber(backendItem.position.x) &&
            this.isValidNumber(backendItem.position.y)) {
            position = backendItem.position;
        } else {
            position = {
                x: this.randomRange(bounds.MIN_X, bounds.MAX_X),
                y: this.randomRange(bounds.MIN_Y, bounds.MAX_Y)
            };
        }

        // 处理速度: 如果后端没有提供或无效，生成随机速度
        let velocity: Velocity;
        if (backendItem.velocity &&
            this.isValidNumber(backendItem.velocity.vx) &&
            this.isValidNumber(backendItem.velocity.vy)) {
            velocity = backendItem.velocity;
        } else {
            velocity = {
                vx: direction * this.randomRange(velocityConfig.MIN_VX, velocityConfig.MAX_VX),
                vy: this.randomRange(velocityConfig.MIN_VY, velocityConfig.MAX_VY)
            };
        }

        // 根据速度方向确定翻转
        const flipX = backendItem.flipX ?? (velocity.vx < 0);

        // 缩放和旋转
        const scale = this.isValidNumber(backendItem.scale)
            ? backendItem.scale
            : this.randomRange(scaleConfig.MIN, scaleConfig.MAX);

        const rotation = this.isValidNumber(backendItem.rotation)
            ? backendItem.rotation
            : this.randomRange(rotationConfig.MIN, rotationConfig.MAX);

        return {
            id: backendItem.id,
            imageUrl: backendItem.imageUrl,
            name: backendItem.name || '',
            description: backendItem.description || '',
            author: backendItem.author || '匿名艺术家',
            isAI: backendItem.isAI,
            createdAt: backendItem.createdAt || Date.now(),
            position,
            velocity,
            rotation,
            scale,
            flipX,
            comments: backendItem.comments || []
        };
    }

    /**
     * 将前端 GameItem 转换为后端提交格式
     */
    static convertToBackendFormat(item: GameItem): {
        image_data: string;
        name: string;
        description: string;
        session_id: string;
        author_name: string;
    } {
        return {
            image_data: item.imageUrl,
            name: item.name,
            description: item.description,
            session_id: '', // 需要从 GameManager 获取
            author_name: item.author
        };
    }

    /**
     * 映射后端 phase 字符串到前端 GamePhase 枚举
     */
    static mapPhase(phase: string): GamePhase {
        const mapping: Record<string, GamePhase> = {
            'lobby': GamePhase.LOBBY,
            'drawing': GamePhase.DRAWING,
            'viewing': GamePhase.VIEWING,
            'active': GamePhase.VIEWING,  // 后端 'active' 映射为 'viewing'
            'voting': GamePhase.VOTING,
            'result': GamePhase.RESULT,
            'gameover': GamePhase.GAMEOVER
        };
        return mapping[phase] || GamePhase.VIEWING;
    }

    /**
     * 转换主题配置
     */
    static convertTheme(backendTheme: any): ThemeConfig | null {
        if (!backendTheme) return null;

        return {
            themeId: backendTheme.themeId || backendTheme.theme_id || '',
            themeName: backendTheme.themeName || backendTheme.theme_name || '',
            assets: {
                backgroundUrl: backendTheme.assets?.backgroundUrl ||
                    backendTheme.assets?.background_url || '',
                particleEffect: backendTheme.assets?.particleEffect ||
                    backendTheme.assets?.particle_effect
            },
            palette: backendTheme.palette || [],
            aiSettings: {
                keywords: backendTheme.aiSettings?.keywords ||
                    backendTheme.ai_settings?.keywords || [],
                promptStyle: backendTheme.aiSettings?.promptStyle ||
                    backendTheme.ai_settings?.prompt_style || ''
            },
            gameRules: {
                spawnRate: backendTheme.gameRules?.spawnRate ||
                    backendTheme.game_rules?.spawn_rate || 1,
                maxImposters: backendTheme.gameRules?.maxImposters ||
                    backendTheme.game_rules?.max_imposters || 3
            }
        };
    }

    /**
     * 批量转换物品列表
     */
    static convertItemList(backendItems: BackendGameItem[]): GameItem[] {
        return backendItems.map(item => this.convertBackendItem(item));
    }

    /**
     * 合并本地和远程物品列表
     * 策略: 远程优先，但保留本地已有物品的最新状态
     */
    static mergeItems(localItems: GameItem[], remoteItems: GameItem[]): GameItem[] {
        const itemMap = new Map<string, GameItem>();

        // 先添加远程的 items
        remoteItems.forEach(item => itemMap.set(item.id, item));

        // 再添加本地的 items (只添加远程没有的)
        localItems.forEach(item => {
            if (!itemMap.has(item.id)) {
                itemMap.set(item.id, item);
            }
        });

        return Array.from(itemMap.values());
    }

    // ==================== 工具方法 ====================

    private static isValidNumber(value: any): value is number {
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
    }

    private static randomRange(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }
}
