import { _decorator, Component, assetManager, ImageAsset, SpriteFrame, Texture2D, error, log } from 'cc';
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
 * 负责从远程 URL 动态加载资源并缓存
 */
@ccclass('ResourceLoader')
export class ResourceLoader extends Component {
    private static _instance: ResourceLoader = null!;

    // 资源缓存：key -> SpriteFrame
    private _cache: Map<string, SpriteFrame> = new Map();

    // 加载中的资源，防止重复加载
    private _loading: Map<string, Promise<SpriteFrame | null>> = new Map();

    public static get instance(): ResourceLoader {
        return this._instance;
    }

    onLoad() {
        ResourceLoader._instance = this;
        log('[ResourceLoader] 资源加载器已初始化');
    }

    /**
     * 预加载所有配置的资源
     * @param bundleName 分包名称（可选）
     * @param onProgress 进度回调
     * @returns 加载结果
     */
    public async preloadResources(
        bundleName?: string,
        onProgress?: LoadProgressCallback
    ): Promise<LoadResult> {
        const resources = ResourceConfig.getPreloadResources(bundleName);

        if (resources.length === 0) {
            log('[ResourceLoader] 没有需要预加载的资源');
            return { success: true, loaded: 0, failed: 0, errors: [] };
        }

        log(`[ResourceLoader] 开始预加载 ${resources.length} 个资源`);

        const result: LoadResult = {
            success: true,
            loaded: 0,
            failed: 0,
            errors: []
        };

        // 并发加载所有资源
        const loadPromises = resources.map(async (resource, index) => {
            try {
                const spriteFrame = await this.loadRemoteImage(resource.url, resource.key);

                if (spriteFrame) {
                    result.loaded++;
                    log(`[ResourceLoader] 成功加载: ${resource.key}`);
                } else {
                    result.failed++;
                    result.errors.push({ key: resource.key, error: '加载失败' });
                    error(`[ResourceLoader] 加载失败: ${resource.key}`);
                }

                // 调用进度回调
                if (onProgress) {
                    onProgress(result.loaded + result.failed, resources.length, resource.key);
                }
            } catch (err) {
                result.failed++;
                result.errors.push({
                    key: resource.key,
                    error: err instanceof Error ? err.message : String(err)
                });
                error(`[ResourceLoader] 加载异常: ${resource.key}`, err);

                // 调用进度回调
                if (onProgress) {
                    onProgress(result.loaded + result.failed, resources.length, resource.key);
                }
            }
        });

        await Promise.all(loadPromises);

        result.success = result.failed === 0;

        log(`[ResourceLoader] 预加载完成: 成功 ${result.loaded}, 失败 ${result.failed}`);

        return result;
    }

    /**
     * 从远程 URL 加载图片
     * @param url 图片 URL
     * @param key 缓存键（可选）
     * @returns SpriteFrame 或 null
     */
    public async loadRemoteImage(url: string, key?: string): Promise<SpriteFrame | null> {
        const cacheKey = key || url;

        // 检查缓存
        if (this._cache.has(cacheKey)) {
            log(`[ResourceLoader] 从缓存获取: ${cacheKey}`);
            return this._cache.get(cacheKey)!;
        }

        // 检查是否正在加载
        if (this._loading.has(cacheKey)) {
            log(`[ResourceLoader] 等待加载中: ${cacheKey}`);
            return this._loading.get(cacheKey)!;
        }

        // 开始加载
        const loadPromise = this._loadImageInternal(url, cacheKey);
        this._loading.set(cacheKey, loadPromise);

        try {
            const spriteFrame = await loadPromise;
            return spriteFrame;
        } finally {
            this._loading.delete(cacheKey);
        }
    }

    /**
     * 内部加载方法
     */
    private async _loadImageInternal(url: string, cacheKey: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            // 从 URL 推断扩展名，去掉查询参数
            const cleanUrl = url.split('?')[0];
            const ext = cleanUrl.match(/\.(png|jpg|jpeg|webp)$/i)?.[0] || '.png';

            assetManager.loadRemote<ImageAsset>(url, { ext }, (err, imageAsset) => {
                if (err) {
                    error(`[ResourceLoader] 加载图片失败: ${url}`, err);
                    resolve(null);
                    return;
                }

                try {
                    // 创建 Texture2D
                    const texture = new Texture2D();
                    texture.image = imageAsset;

                    // 创建 SpriteFrame
                    const spriteFrame = new SpriteFrame();
                    spriteFrame.texture = texture;

                    // 缓存
                    this._cache.set(cacheKey, spriteFrame);
                    log(`[ResourceLoader] 加载成功: ${cacheKey}`);

                    resolve(spriteFrame);
                } catch (error) {
                    error(`[ResourceLoader] 创建 SpriteFrame 失败: ${cacheKey}`, error);
                    resolve(null);
                }
            });
        });
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
        ResourceLoader._instance = null!;
    }
}
