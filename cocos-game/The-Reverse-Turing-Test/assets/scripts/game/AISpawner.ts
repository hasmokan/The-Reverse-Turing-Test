import { _decorator, Component, ImageAsset, SpriteFrame, Texture2D } from 'cc';
import { GameManager } from '../core/GameManager';

const { ccclass } = _decorator;

// AI鱼名称池
const AI_NAMES: string[] = [
    '小蓝', '泡泡', '闪闪', '波波', '嘟嘟',
    '小金', '银鳞', '彩虹', '珊瑚', '海星',
    '水滴', '浪花', '深蓝', '翡翠', '琥珀',
    '月光', '星辰', '晨曦', '暮色', '极光'
];

// AI鱼描述池
const AI_DESCRIPTIONS: string[] = [
    '一条快乐的小鱼~',
    '在海底自由游泳！',
    '我是最漂亮的鱼！',
    '今天天气真好呀',
    '寻找美味的海藻中...',
    '和朋友们一起玩耍',
    '探索神秘的海底世界',
    '阳光照进海底真温暖',
    '我的鳞片闪闪发光',
    '游啊游，好开心'
];

// 鱼身体颜色池
const FISH_COLORS: string[] = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA'
];

// 1x1 白色像素，作为极端环境（无 canvas API）下的兜底图片
const FALLBACK_AI_FISH_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6z2ioAAAAASUVORK5CYII=';

/**
 * AI鱼生成器
 * 随机阈值机制，程序化生成彩色鱼形占位图
 */
@ccclass('AISpawner')
export class AISpawner extends Component {

    // 当前计数器
    private _humanFishCount: number = 0;
    // 当前阈值（达到后生成AI鱼）
    private _currentThreshold: number = 0;
    // 已使用的名称索引
    private _usedNameIndices: Set<number> = new Set();

    onLoad() {
        this._currentThreshold = this.randomThreshold();
    }

    /**
     * 随机生成阈值 (3-7)
     */
    private randomThreshold(): number {
        return Math.floor(Math.random() * 5) + 3;
    }

    /**
     * 当人类创建了一条鱼时调用
     * 计数器+1，达到阈值时自动生成AI鱼
     * @returns 是否触发了AI鱼生成
     */
    onHumanFishCreated(): boolean {
        this._humanFishCount++;

        if (this._humanFishCount >= this._currentThreshold) {
            this.spawnAIFish();
            this._humanFishCount = 0;
            this._currentThreshold = this.randomThreshold();
            return true;
        }
        return false;
    }

    /**
     * 预生成指定数量的AI鱼
     */
    preSpawnAIFish(count: number): void {
        for (let i = 0; i < count; i++) {
            this.scheduleOnce(() => {
                this.spawnAIFish();
            }, i * 0.5); // 间隔0.5s逐个生成
        }
    }

    /**
     * 生成一条AI鱼
     */
    private spawnAIFish(): void {
        const gm = GameManager.instance;
        if (!gm) return;

        const name = this.pickRandomName();
        const description = AI_DESCRIPTIONS[Math.floor(Math.random() * AI_DESCRIPTIONS.length)];
        const imageUrl = this.generateFishImageBase64();

        gm.addItem({
            name,
            description,
            imageUrl,
            author: 'AI画师',
            isAI: true,
        });
    }

    /**
     * 从名称池中随机选取（尽量不重复）
     */
    private pickRandomName(): string {
        if (this._usedNameIndices.size >= AI_NAMES.length) {
            this._usedNameIndices.clear();
        }

        let idx: number;
        do {
            idx = Math.floor(Math.random() * AI_NAMES.length);
        } while (this._usedNameIndices.has(idx));

        this._usedNameIndices.add(idx);
        return AI_NAMES[idx];
    }

    /**
     * 程序化生成彩色鱼形占位图（Canvas 2D → base64）
     */
    private generateFishImageBase64(): string {
        const size = 120;
        const canvas = this.createCanvas(size);
        if (!canvas) {
            console.warn('[AISpawner] 当前运行环境不支持 Canvas，使用兜底图片');
            return FALLBACK_AI_FISH_IMAGE;
        }

        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn('[AISpawner] Canvas 2D 上下文不可用，使用兜底图片');
            return FALLBACK_AI_FISH_IMAGE;
        }

        // 背景透明
        ctx.clearRect(0, 0, size, size);

        const bodyColor = FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)];
        const cx = size / 2;
        const cy = size / 2;

        // 鱼身体（椭圆）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1.4, 1);
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.restore();
        ctx.fillStyle = bodyColor;
        ctx.fill();

        // 鱼尾巴（三角形）
        ctx.beginPath();
        ctx.moveTo(cx - 38, cy);
        ctx.lineTo(cx - 55, cy - 18);
        ctx.lineTo(cx - 55, cy + 18);
        ctx.closePath();
        ctx.fillStyle = bodyColor;
        ctx.fill();

        // 鱼眼睛
        ctx.beginPath();
        ctx.arc(cx + 18, cy - 6, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 19, cy - 6, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#333333';
        ctx.fill();

        // 鱼鳍（上）
        ctx.beginPath();
        ctx.moveTo(cx, cy - 25);
        ctx.quadraticCurveTo(cx + 5, cy - 45, cx - 10, cy - 35);
        ctx.fillStyle = this.darkenColor(bodyColor, 0.2);
        ctx.fill();

        // 鱼嘴
        ctx.beginPath();
        ctx.arc(cx + 35, cy + 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FF6666';
        ctx.fill();

        if (typeof canvas.toDataURL === 'function') {
            return canvas.toDataURL('image/png');
        }

        return FALLBACK_AI_FISH_IMAGE;
    }

    private createCanvas(size: number): any | null {
        const globalObj = globalThis as any;
        const doc = globalObj.document as any;
        if (doc && typeof doc.createElement === 'function') {
            return doc.createElement('canvas');
        }

        const wx = globalObj.wx;
        if (wx && typeof wx.createOffscreenCanvas === 'function') {
            try {
                const offscreen = wx.createOffscreenCanvas({ type: '2d', width: size, height: size });
                return offscreen;
            } catch (error) {
                console.warn('[AISpawner] createOffscreenCanvas failed:', error);
            }
        }

        return null;
    }

    /**
     * 颜色加深
     */
    private darkenColor(hex: string, amount: number): string {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, ((num >> 16) & 0xFF) * (1 - amount));
        const g = Math.max(0, ((num >> 8) & 0xFF) * (1 - amount));
        const b = Math.max(0, (num & 0xFF) * (1 - amount));
        return `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
    }

    /**
     * 重置状态
     */
    reset(): void {
        this._humanFishCount = 0;
        this._currentThreshold = this.randomThreshold();
        this._usedNameIndices.clear();
    }
}
