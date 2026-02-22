/**
 * 平台适配器
 * 提供跨平台的统一接口
 *
 * 支持平台:
 * - Web 浏览器
 * - 微信小游戏
 */

import { sys, log as ccLog, error as ccError } from 'cc';
import { PLATFORM } from '../data/GameConstants';

// ==================== 平台适配器接口 ====================

export interface IPlatformAdapter {
    // 平台信息
    getPlatformName(): string;
    isWeChat(): boolean;

    // 存储
    getStorage(key: string): string | null;
    setStorage(key: string, value: string): void;
    removeStorage(key: string): void;

    // 用户系统
    login(): Promise<{ sessionId: string }>;
    getUserInfo(): Promise<{ nickName: string; avatarUrl: string }>;

    // 图片处理
    canvasToTempFile(canvas: HTMLCanvasElement): Promise<string>;
    saveImageToAlbum(imagePath: string): Promise<void>;

    // 分享
    shareAppMessage(options: {
        title: string;
        imageUrl?: string;
        query?: string;
    }): void;

    // 震动反馈
    vibrate(type?: 'light' | 'medium' | 'heavy'): void;

    // 剪贴板
    setClipboard(data: string): Promise<void>;

    // 显示/隐藏
    onShow(callback: () => void): void;
    onHide(callback: () => void): void;
}

// ==================== Web 平台适配器 ====================

export class WebAdapter implements IPlatformAdapter {
    private showCallbacks: (() => void)[] = [];
    private hideCallbacks: (() => void)[] = [];

    constructor() {
        // 监听页面可见性变化
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.hideCallbacks.forEach(cb => cb());
                } else {
                    this.showCallbacks.forEach(cb => cb());
                }
            });
        }
    }

    getPlatformName(): string {
        return 'Web';
    }

    isWeChat(): boolean {
        return false;
    }

    getStorage(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            ccError('[WebAdapter] getStorage failed:', e);
            return null;
        }
    }

    setStorage(key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            ccError('[WebAdapter] setStorage failed:', e);
        }
    }

    removeStorage(key: string): void {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            ccError('[WebAdapter] removeStorage failed:', e);
        }
    }

    async login(): Promise<{ sessionId: string }> {
        // Web 端生成随机 session ID
        let sessionId = this.getStorage('sessionId');
        if (!sessionId) {
            sessionId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.setStorage('sessionId', sessionId);
        }
        return { sessionId };
    }

    async getUserInfo(): Promise<{ nickName: string; avatarUrl: string }> {
        // Web 端使用默认用户信息
        return {
            nickName: '访客',
            avatarUrl: ''
        };
    }

    async canvasToTempFile(canvas: HTMLCanvasElement): Promise<string> {
        return canvas.toDataURL('image/png');
    }

    async saveImageToAlbum(imagePath: string): Promise<void> {
        // Web 端通过下载方式保存图片
        const link = document.createElement('a');
        link.href = imagePath;
        link.download = `drawing_${Date.now()}.png`;
        link.click();
    }

    shareAppMessage(options: { title: string; imageUrl?: string; query?: string }): void {
        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

        // Web 端使用 Web Share API
        if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share({
                title: options.title,
                text: PLATFORM.SHARE.DESC,
                url: currentUrl + (options.query ? `?${options.query}` : '')
            }).catch(err => {
                ccLog('[WebAdapter] Share failed:', err);
            });
        } else {
            // 复制链接到剪贴板
            const url = currentUrl + (options.query ? `?${options.query}` : '');
            this.setClipboard(url);
            ccLog('[WebAdapter] Share link copied to clipboard');
        }
    }

    vibrate(type?: 'light' | 'medium' | 'heavy'): void {
        // Web 端使用 Vibration API
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            const duration = type === 'heavy' ? 100 : type === 'light' ? 30 : 50;
            navigator.vibrate(duration);
        }
    }

    async setClipboard(data: string): Promise<void> {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(data);
        }
    }

    onShow(callback: () => void): void {
        this.showCallbacks.push(callback);
    }

    onHide(callback: () => void): void {
        this.hideCallbacks.push(callback);
    }
}

// ==================== 微信小游戏适配器 ====================

export class WeChatAdapter implements IPlatformAdapter {
    private wx: any = null;

    constructor() {
        const globalObj = globalThis as any;
        this.wx = globalObj.wx || (typeof window !== 'undefined' ? (window as any).wx : null);
        if (!this.wx) {
            ccError('[WeChatAdapter] WeChat API not available');
        }
    }

    getPlatformName(): string {
        return 'WeChat';
    }

    isWeChat(): boolean {
        return true;
    }

    getStorage(key: string): string | null {
        try {
            return this.wx.getStorageSync(key) || null;
        } catch (e) {
            ccError('[WeChatAdapter] getStorage failed:', e);
            return null;
        }
    }

    setStorage(key: string, value: string): void {
        try {
            this.wx.setStorageSync(key, value);
        } catch (e) {
            ccError('[WeChatAdapter] setStorage failed:', e);
        }
    }

    removeStorage(key: string): void {
        try {
            this.wx.removeStorageSync(key);
        } catch (e) {
            ccError('[WeChatAdapter] removeStorage failed:', e);
        }
    }

    async login(): Promise<{ sessionId: string }> {
        return new Promise((resolve, reject) => {
            this.wx.login({
                success: (res: { code: string }) => {
                    // 使用微信登录 code 作为 sessionId
                    // 实际项目中应该发送到服务器换取 session
                    resolve({ sessionId: `wx_${res.code}` });
                },
                fail: (err: any) => {
                    ccError('[WeChatAdapter] login failed:', err);
                    // 登录失败时生成临时 ID
                    resolve({ sessionId: `wx_temp_${Date.now()}` });
                }
            });
        });
    }

    async getUserInfo(): Promise<{ nickName: string; avatarUrl: string }> {
        return new Promise((resolve) => {
            this.wx.getUserInfo({
                success: (res: { userInfo: { nickName: string; avatarUrl: string } }) => {
                    resolve(res.userInfo);
                },
                fail: () => {
                    resolve({ nickName: '微信用户', avatarUrl: '' });
                }
            });
        });
    }

    async canvasToTempFile(canvas: any): Promise<string> {
        return new Promise((resolve, reject) => {
            this.wx.canvasToTempFilePath({
                canvas,
                success: (res: { tempFilePath: string }) => {
                    resolve(res.tempFilePath);
                },
                fail: (err: any) => {
                    reject(err);
                }
            });
        });
    }

    async saveImageToAlbum(imagePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.wx.saveImageToPhotosAlbum({
                filePath: imagePath,
                success: () => resolve(),
                fail: (err: any) => reject(err)
            });
        });
    }

    shareAppMessage(options: { title: string; imageUrl?: string; query?: string }): void {
        this.wx.shareAppMessage({
            title: options.title,
            imageUrl: options.imageUrl || PLATFORM.SHARE.IMAGE_URL,
            query: options.query || ''
        });
    }

    vibrate(type?: 'light' | 'medium' | 'heavy'): void {
        this.wx.vibrateShort({ type: type || 'medium' });
    }

    async setClipboard(data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.wx.setClipboardData({
                data,
                success: () => resolve(),
                fail: (err: any) => reject(err)
            });
        });
    }

    onShow(callback: () => void): void {
        this.wx.onShow(callback);
    }

    onHide(callback: () => void): void {
        this.wx.onHide(callback);
    }

    // ==================== 微信特有功能 ====================

    /**
     * 初始化微信小游戏环境
     */
    init(): void {
        if (!this.wx) return;

        // 保持屏幕常亮
        this.wx.setKeepScreenOn({ keepScreenOn: true });

        // 初始化分享
        this.wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
        });

        // 设置默认分享内容
        this.wx.onShareAppMessage(() => ({
            title: PLATFORM.SHARE.TITLE,
            imageUrl: PLATFORM.SHARE.IMAGE_URL
        }));
    }

    /**
     * 显示激励视频广告
     */
    showRewardedAd(adUnitId: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.wx) {
                resolve(false);
                return;
            }

            const ad = this.wx.createRewardedVideoAd({ adUnitId });

            ad.onClose((res: { isEnded: boolean }) => {
                resolve(res && res.isEnded);
            });

            ad.show().catch(() => {
                ad.load().then(() => ad.show()).catch(() => resolve(false));
            });
        });
    }

    /**
     * 获取启动参数
     */
    getLaunchOptions(): { query: Record<string, string>; scene: number } {
        if (!this.wx) {
            return { query: {}, scene: 0 };
        }
        const options = this.wx.getLaunchOptionsSync();
        return {
            query: options.query || {},
            scene: options.scene || 0
        };
    }
}

// ==================== 平台工厂 ====================

let _adapter: IPlatformAdapter | null = null;

/**
 * 获取平台适配器 (单例)
 */
export function getPlatformAdapter(): IPlatformAdapter {
    if (_adapter) return _adapter;

    const hasWx = !!(globalThis as any).wx;
    if (sys.platform === sys.Platform.WECHAT_GAME || hasWx) {
        _adapter = new WeChatAdapter();
        // 初始化微信环境
        (_adapter as WeChatAdapter).init();
    } else {
        _adapter = new WebAdapter();
    }

    ccLog(`[Platform] Using ${_adapter.getPlatformName()} adapter`);
    return _adapter;
}

/**
 * 获取/生成 Session ID
 */
export async function getSessionId(): Promise<string> {
    const adapter = getPlatformAdapter();
    const result = await adapter.login();
    return result.sessionId;
}
