import { _decorator, Component, assetManager, ImageAsset, SpriteFrame, Texture2D, AssetManager, error, log, sys } from 'cc';
import { ResourceConfig, RemoteResource } from './ResourceConfig';

const { ccclass } = _decorator;

/**
 * 加载进度回调
 */
export interface LoadProgressCallback {
    (loaded: number, total: number, currentItem: string): void;
}

/**
 * 资源加载结果
 */
export interface LoadResult {
    success: boolean;
    loaded: number;
    failed: number;
    errors: Array<{ key: string; error: string }>;
}

/**
 * 资源加载管理器
 *
 * 加载策略（分环境）：
 * - 浏览器/开发环境：优先通过 Asset Bundle 加载，失败则 fallback 远程 URL
 * - 微信小游戏：直接从远程 COS URL 加载（构建时 native/ 已清理以控制包体大小）
 */
@ccclass('ResourceLoader')
export class ResourceLoader extends Component {
    private static _instance: ResourceLoader = null!;

    // 资源缓存：key -> SpriteFrame
    private _cache: Map<string, SpriteFrame> = new Map();

    // 加载中的资源，防止重复加载
    private _loading: Map<string, Promise<SpriteFrame | null>> = new Map();

    // 已加载的 Bundle 实例
    private _bundle: AssetManager.Bundle | null = null;

    // Bundle 单资源加载超时时间（毫秒）
    private static readonly BUNDLE_LOAD_TIMEOUT = 5000;

    // 远程 URL 加载超时时间（毫秒）
    private static readonly REMOTE_LOAD_TIMEOUT = 15000;

    public static get instance(): ResourceLoader {
        return this._instance;
    }

    /**
     * 检测是否为微信小游戏环境
     */
    private static _isWeChatMiniGame(): boolean {
        return sys.platform === sys.Platform.WECHAT_GAME;
    }

    onLoad() {
        ResourceLoader._instance = this;
        const env = ResourceLoader._isWeChatMiniGame() ? '微信小游戏' : '浏览器';
        log(`[ResourceLoader] 资源加载器已初始化 (${env}环境)`);
    }

    /**
     * 加载 Asset Bundle
     * @returns Bundle 实例，失败返回 null
     */
    public loadBundle(): Promise<AssetManager.Bundle | null> {
        if (this._bundle) {
            return Promise.resolve(this._bundle);
        }

        return new Promise((resolve) => {
            const bundleName = ResourceConfig.BUNDLE_NAME;
            log(`[ResourceLoader] 加载 Bundle: ${bundleName}`);

            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err) {
                    error(`[ResourceLoader] Bundle 加载失败: ${bundleName}`, err);
                    resolve(null);
                    return;
                }

                this._bundle = bundle;
                log(`[ResourceLoader] Bundle 加载成功: ${bundleName}`);
                resolve(bundle);
            });
        });
    }

    /**
     * 预加载所有配置的资源
     * @param onProgress 进度回调
     * @returns 加载结果
     */
    public async preloadResources(
        _bundleName?: string,
        onProgress?: LoadProgressCallback
    ): Promise<LoadResult> {
        const resources = ResourceConfig.getPreloadResources();

        if (resources.length === 0) {
            log('[ResourceLoader] 没有需要预加载的资源');
            return { success: true, loaded: 0, failed: 0, errors: [] };
        }

        log(`[ResourceLoader] 开始预加载 ${resources.length} 个资源`);

        // 仅在非微信环境下加载 Bundle（微信环境 native/ 已清理，直接走远程 URL）
        if (!ResourceLoader._isWeChatMiniGame()) {
            await this.loadBundle();
        } else {
            log('[ResourceLoader] 微信小游戏环境，跳过 Bundle 加载，直接使用远程 URL');
        }

        const result: LoadResult = {
            success: true,
            loaded: 0,
            failed: 0,
            errors: []
        };

        // 并发加载所有资源
        const loadPromises = resources.map(async (resource) => {
            try {
                const spriteFrame = await this._loadResource(resource);

                if (spriteFrame) {
                    result.loaded++;
                    log(`[ResourceLoader] 成功加载: ${resource.key}`);
                } else {
                    result.failed++;
                    result.errors.push({ key: resource.key, error: '加载失败' });
                    error(`[ResourceLoader] 加载失败: ${resource.key}`);
                }
            } catch (err) {
                result.failed++;
                result.errors.push({
                    key: resource.key,
                    error: err instanceof Error ? err.message : String(err)
                });
                error(`[ResourceLoader] 加载异常: ${resource.key}`, err);
            }

            // 调用进度回调
            if (onProgress) {
                onProgress(result.loaded + result.failed, resources.length, resource.key);
            }
        });

        await Promise.all(loadPromises);

        result.success = result.failed === 0;
        log(`[ResourceLoader] 预加载完成: 成功 ${result.loaded}, 失败 ${result.failed}`);

        return result;
    }

    /**
     * 加载单个资源：优先 Bundle，fallback 远程 URL
     */
    private async _loadResource(resource: RemoteResource): Promise<SpriteFrame | null> {
        const cacheKey = resource.key;

        // 检查缓存
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey)!;
        }

        // 检查是否正在加载
        if (this._loading.has(cacheKey)) {
            return this._loading.get(cacheKey)!;
        }

        const loadPromise = this._doLoad(resource);
        this._loading.set(cacheKey, loadPromise);

        try {
            return await loadPromise;
        } finally {
            this._loading.delete(cacheKey);
        }
    }

    /**
     * 实际加载逻辑
     * - 微信小游戏：直接从远程 COS URL 加载（构建时 native/ 已清理）
     * - 浏览器：Bundle 优先，失败则 fallback 远程 URL
     */
    private async _doLoad(resource: RemoteResource): Promise<SpriteFrame | null> {
        // 微信小游戏环境：直接从远程 URL 加载
        // 构建时已通过 build-helper 清理 native/ 目录，bundle.load() 会因缺少 native 文件而挂起
        if (ResourceLoader._isWeChatMiniGame()) {
            log(`[ResourceLoader] 远程加载: ${resource.key}`);
            return this._loadFromRemoteUrl(resource.remoteUrl, resource.key);
        }

        // 浏览器/开发环境：Bundle 优先
        if (this._bundle) {
            const spriteFrame = await this._loadFromBundle(resource.bundlePath, resource.key);
            if (spriteFrame) {
                return spriteFrame;
            }
            log(`[ResourceLoader] Bundle 加载失败，尝试远程 URL: ${resource.key}`);
        }

        // fallback 到远程 URL
        return this._loadFromRemoteUrl(resource.remoteUrl, resource.key);
    }

    /**
     * 从 Bundle 加载 SpriteFrame（带超时保护）
     */
    private _loadFromBundle(bundlePath: string, cacheKey: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            if (!this._bundle) {
                resolve(null);
                return;
            }

            let resolved = false;

            // 超时保护：防止 bundle.load() 因缺少 native 文件而永远不回调
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    log(`[ResourceLoader] Bundle 加载超时: ${bundlePath}`);
                    resolve(null);
                }
            }, ResourceLoader.BUNDLE_LOAD_TIMEOUT);

            this._bundle.load(bundlePath, SpriteFrame, (err, spriteFrame) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timer);

                if (err) {
                    error(`[ResourceLoader] Bundle 资源加载失败: ${bundlePath}`, err);
                    resolve(null);
                    return;
                }

                this._cache.set(cacheKey, spriteFrame);
                resolve(spriteFrame);
            });
        });
    }

    /**
     * 从远程 URL 加载图片（带超时保护）
     */
    private _loadFromRemoteUrl(url: string, cacheKey: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            const cleanUrl = url.split('?')[0];
            const ext = cleanUrl.match(/\.(png|jpg|jpeg|webp)$/i)?.[0] || '.png';

            let resolved = false;

            // 超时保护
            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    error(`[ResourceLoader] 远程加载超时 (${ResourceLoader.REMOTE_LOAD_TIMEOUT}ms): ${cacheKey}`);
                    resolve(null);
                }
            }, ResourceLoader.REMOTE_LOAD_TIMEOUT);

            assetManager.loadRemote<ImageAsset>(url, { ext }, (err, imageAsset) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timer);

                if (err) {
                    error(`[ResourceLoader] 远程图片加载失败: ${url}`, err);
                    resolve(null);
                    return;
                }

                try {
                    const texture = new Texture2D();
                    texture.image = imageAsset;

                    const spriteFrame = new SpriteFrame();
                    spriteFrame.texture = texture;

                    this._cache.set(cacheKey, spriteFrame);
                    resolve(spriteFrame);
                } catch (e) {
                    error(`[ResourceLoader] 创建 SpriteFrame 失败: ${cacheKey}`, e);
                    resolve(null);
                }
            });
        });
    }

    /**
     * 从远程 URL 加载图片（公开方法，供外部动态加载使用）
     */
    public async loadRemoteImage(url: string, key?: string): Promise<SpriteFrame | null> {
        const cacheKey = key || url;

        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey)!;
        }

        if (this._loading.has(cacheKey)) {
            return this._loading.get(cacheKey)!;
        }

        const loadPromise = this._loadFromRemoteUrl(url, cacheKey);
        this._loading.set(cacheKey, loadPromise);

        try {
            return await loadPromise;
        } finally {
            this._loading.delete(cacheKey);
        }
    }

    /**
     * 根据 key 获取已加载的 SpriteFrame
     */
    public getSpriteFrame(key: string): SpriteFrame | null {
        return this._cache.get(key) || null;
    }

    /**
     * 检查资源是否已加载
     */
    public isLoaded(key: string): boolean {
        return this._cache.has(key);
    }

    /**
     * 清除所有缓存
     */
    public clearCache(): void {
        this._cache.clear();
        this._loading.clear();
        log('[ResourceLoader] 缓存已清除');
    }

    /**
     * 清除指定资源的缓存
     */
    public clearCacheByKey(key: string): void {
        this._cache.delete(key);
        log(`[ResourceLoader] 已清除缓存: ${key}`);
    }

    onDestroy() {
        this.clearCache();
        this._bundle = null;
        ResourceLoader._instance = null!;
    }
}
