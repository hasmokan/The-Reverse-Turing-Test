/**
 * 远程资源配置管理器
 * 定义所有需要从 COS 加载的资源 URL
 */

export interface RemoteResource {
    key: string;         // 资源唯一标识
    url: string;         // COS URL
    type: 'image' | 'audio' | 'json'; // 资源类型
    preload: boolean;    // 是否预加载
    bundle?: string;     // 所属分包（可选）
}

export class ResourceConfig {
    // COS 基础路径
    private static readonly COS_BASE_URL = 'https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com';

    /**
     * 所有远程资源配置
     */
    /**
     * 资源 key 与场景节点名称的映射
     * key: ResourceConfig 中的资源 key
     * value: 场景中对应的节点名称
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

    public static readonly REMOTE_RESOURCES: RemoteResource[] = [
        // 主场景背景图
        {
            key: 'home_bg',
            url: `${ResourceConfig.COS_BASE_URL}/anime_lobby_variant_1%20%285%29.png`,
            type: 'image',
            preload: true
        },
        // 多人游戏按钮
        {
            key: 'multiplay',
            url: `${ResourceConfig.COS_BASE_URL}/multiplay.png`,
            type: 'image',
            preload: true
        },
        // 排行榜按钮
        {
            key: 'rank',
            url: `${ResourceConfig.COS_BASE_URL}/rank.png`,
            type: 'image',
            preload: true
        },
        // 单人游戏按钮
        {
            key: 'single_play',
            url: `${ResourceConfig.COS_BASE_URL}/single_play.png`,
            type: 'image',
            preload: true
        },
        // 标题图片
        {
            key: 'title_img',
            url: `${ResourceConfig.COS_BASE_URL}/anime_lobby_variant_1%20(2).png`,
            type: 'image',
            preload: true
        },
        // 个人资料按钮
        {
            key: 'profile',
            url: `${ResourceConfig.COS_BASE_URL}/profile.png`,
            type: 'image',
            preload: true
        },
        // 浮动图标 - 齿轮1
        {
            key: 'icon_gear1',
            url: `${ResourceConfig.COS_BASE_URL}/%E7%81%B0%E8%89%B2%E9%BD%BF%E8%BD%AE%E5%9B%BE%E6%A0%871.png`,
            type: 'image',
            preload: true
        },
        // 浮动图标 - 齿轮2
        {
            key: 'icon_gear2',
            url: `${ResourceConfig.COS_BASE_URL}/%E7%81%B0%E8%89%B2%E9%BD%BF%E8%BD%AE%E5%9B%BE%E6%A0%872.png`,
            type: 'image',
            preload: true
        },
        // 浮动图标 - 大脑
        {
            key: 'icon_brain',
            url: `${ResourceConfig.COS_BASE_URL}/%E8%82%89%E8%89%B2%E5%A4%A7%E8%84%91%E5%9B%BE%E6%A0%87.png`,
            type: 'image',
            preload: true
        },
        // 浮动图标 - 灯泡
        {
            key: 'icon_bulb',
            url: `${ResourceConfig.COS_BASE_URL}/%E9%BB%84%E8%89%B2%E7%81%AF%E6%B3%A1%E5%9B%BE%E6%A0%87.png`,
            type: 'image',
            preload: true
        },
        // 画板页面背景图
        {
            key: 'game_bg',
            url: `${ResourceConfig.COS_BASE_URL}/9_16_hand-drawn_grid_canvas.png`,
            type: 'image',
            preload: true,
            bundle: 'game'
        },
    ];

    /**
     * 获取需要预加载的资源列表
     */
    public static getPreloadResources(bundleName?: string): RemoteResource[] {
        return this.REMOTE_RESOURCES.filter(res => {
            if (!res.preload) return false;
            if (bundleName) {
                return res.bundle === bundleName;
            }
            return !res.bundle; // 只返回主包资源
        });
    }

    /**
     * 根据 key 获取资源配置
     */
    public static getResource(key: string): RemoteResource | undefined {
        return this.REMOTE_RESOURCES.find(res => res.key === key);
    }

    /**
     * 根据 key 获取资源 URL
     */
    public static getResourceUrl(key: string): string | undefined {
        const resource = this.getResource(key);
        return resource?.url;
    }
}
