/**
 * 远程资源配置管理器
 *
 * Asset Bundle 方案：
 * - 资源放在 assets/RemoteUI/ 文件夹中，编辑器中可直接拖拽到 Sprite 使用
 * - 该文件夹配置为 Bundle，构建时设置为 Remote，不进入主包
 * - 运行时通过 assetManager.loadBundle() 加载，引擎自动处理依赖
 */

export interface RemoteResource {
    key: string;                     // 资源唯一标识
    bundlePath: string;              // Bundle 内资源路径（不含扩展名）
    remoteUrl: string;               // COS 远程 URL（fallback / 动态加载用）
    type: 'image' | 'audio' | 'json';
    preload: boolean;
}

export class ResourceConfig {
    // Asset Bundle 名称（对应 assets/RemoteUI 文件夹）
    public static readonly BUNDLE_NAME = 'RemoteUI';

    // COS 基础路径（用于 fallback 或非 bundle 资源）
    private static readonly COS_BASE_URL = 'https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com';

    /**
     * 资源 key → 场景节点名称的映射
     */
    public static readonly NODE_MAPPING: Record<string, string> = {
        'home_bg': 'Background',
        'multiplay': 'multiplay',
        'rank': 'rank',
        'single_play': 'single_play',
        'title_img': 'anime_lobby_variant_1 (2)',
        'profile': 'profile',
        'icon_gear1': '灰色齿轮图标1',
        'icon_gear2': '灰色齿轮图标2',
        'icon_brain': '肉色大脑图标',
        'icon_bulb': '黄色灯泡图标',
    };

    /**
     * 所有远程资源配置
     * bundlePath: Bundle 内的资源路径（文件名不含扩展名）
     * remoteUrl: 原始 COS URL，用于 fallback
     */
    public static readonly REMOTE_RESOURCES: RemoteResource[] = [
        {
            key: 'home_bg',
            bundlePath: 'home_bg/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/anime_lobby_variant_1%20%285%29.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'multiplay',
            bundlePath: 'multiplay/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/multiplay.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'rank',
            bundlePath: 'rank/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/rank.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'single_play',
            bundlePath: 'single_play/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/single_play.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'title_img',
            bundlePath: 'title_img/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/anime_lobby_variant_1%20(2).png`,
            type: 'image',
            preload: true
        },
        {
            key: 'profile',
            bundlePath: 'profile/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/profile.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'icon_gear1',
            bundlePath: 'icon_gear1/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/%E7%81%B0%E8%89%B2%E9%BD%BF%E8%BD%AE%E5%9B%BE%E6%A0%871.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'icon_gear2',
            bundlePath: 'icon_gear2/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/%E7%81%B0%E8%89%B2%E9%BD%BF%E8%BD%AE%E5%9B%BE%E6%A0%872.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'icon_brain',
            bundlePath: 'icon_brain/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/%E8%82%89%E8%89%B2%E5%A4%A7%E8%84%91%E5%9B%BE%E6%A0%87.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'icon_bulb',
            bundlePath: 'icon_bulb/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/%E9%BB%84%E8%89%B2%E7%81%AF%E6%B3%A1%E5%9B%BE%E6%A0%87.png`,
            type: 'image',
            preload: true
        },
        {
            key: 'game_bg',
            bundlePath: 'game_bg/spriteFrame',
            remoteUrl: `${ResourceConfig.COS_BASE_URL}/9_16_hand-drawn_grid_canvas.png`,
            type: 'image',
            preload: true
        },
    ];

    /**
     * 获取需要预加载的资源列表
     */
    public static getPreloadResources(): RemoteResource[] {
        return this.REMOTE_RESOURCES.filter(res => res.preload);
    }

    /**
     * 根据 key 获取资源配置
     */
    public static getResource(key: string): RemoteResource | undefined {
        return this.REMOTE_RESOURCES.find(res => res.key === key);
    }

    /**
     * 根据 key 获取 bundle 内资源路径
     */
    public static getBundlePath(key: string): string | undefined {
        const resource = this.getResource(key);
        return resource?.bundlePath;
    }

    /**
     * 根据 key 获取远程 URL（fallback 用）
     */
    public static getResourceUrl(key: string): string | undefined {
        const resource = this.getResource(key);
        return resource?.remoteUrl;
    }
}
