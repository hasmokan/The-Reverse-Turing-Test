import { _decorator, Component, assetManager, ImageAsset, SpriteFrame, Texture2D, AssetManager, error, log } from 'cc';
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
 * 加载策略：
 * 1. 优先通过 Asset Bundle 加载（资源在 RemoteUI bundle 中）
 * 2. 若 Bundle 加载失败，fallback 到远程 URL 加载
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

    public static get instance(): ResourceLoader {
        return this._instance;
    }

    onLoad() {
        ResourceLoader._instance = this;
        log('[ResourceLoader] 资源加载器已初始化');
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

        // 优先尝试加载 Bundle
        await this.loadBundle();

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
     * 实际加载逻辑：Bundle 优先，URL fallback
     */
    private async _doLoad(resource: RemoteResource): Promise<SpriteFrame | null> {
        // 策略一：从 Bundle 加载
        if (this._bundle) {
            const spriteFrame = await this._loadFromBundle(resource.bundlePath, resource.key);
            if (spriteFrame) {
                return spriteFrame;
            }
            log(`[ResourceLoader] Bundle 加载失败，尝试远程 URL: ${resource.key}`);
        }

        // 策略二：fallback 到远程 URL
        return this._loadFromRemoteUrl(resource.remoteUrl, resource.key);
    }

    /**
     * 从 Bundle 加载 SpriteFrame
     */
    private _loadFromBundle(bundlePath: string, cacheKey: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            if (!this._bundle) {
                resolve(null);
                return;
            }

            this._bundle.load(bundlePath, SpriteFrame, (err, spriteFrame) => {
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
     * 从远程 URL 加载图片（fallback 方式）
     */
    private _loadFromRemoteUrl(url: string, cacheKey: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            const cleanUrl = url.split('?')[0];
            const ext = cleanUrl.match(/\.(png|jpg|jpeg|webp)$/i)?.[0] || '.png';

            assetManager.loadRemote<ImageAsset>(url, { ext }, (err, imageAsset) => {
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
