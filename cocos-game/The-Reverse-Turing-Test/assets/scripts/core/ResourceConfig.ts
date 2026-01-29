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
    public static readonly REMOTE_RESOURCES: RemoteResource[] = [
        // 主场景背景图
        {
            key: 'home_bg',
            url: `${ResourceConfig.COS_BASE_URL}/anime_lobby_variant_1.png`,
            type: 'image',
            preload: true
        },
        // 可以继续添加更多资源
        // {
        //     key: 'game_bg',
        //     url: `${ResourceConfig.COS_BASE_URL}/game_background.png`,
        //     type: 'image',
        //     preload: true,
        //     bundle: 'game'
        // },
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
