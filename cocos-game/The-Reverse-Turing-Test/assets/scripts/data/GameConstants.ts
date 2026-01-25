/**
 * 游戏常量配置
 * 迁移自: frontend/src/lib/battleConstants.ts 和 frontend/src/config/env.ts
 */

// ==================== 环境配置 ====================

export const ENV_CONFIG = {
    // 后端 API 地址 (根据实际部署修改)
    API_URL: 'https://api.hasmodream.ccwu.cc',

    // WebSocket 地址
    WS_URL: 'wss://api.hasmodream.ccwu.cc',

    // AI 审核 API (阶跃星辰 Vision)
    VISION_API_URL: 'https://api.stepfun.com/v1/chat/completions',
    VISION_API_KEY: '', // 需要用户配置
    VISION_MODEL: 'step-1o-turbo-vision'
};

// ==================== 战斗系统常量 ====================

export const BATTLE_CONSTANTS = {
    // CD 冷却时间 (毫秒)
    COOLDOWN_DURATION: 7500,

    // 淘汰阈值 (累计票数)
    ELIMINATION_THRESHOLD: 4,

    // 胜利条件
    VICTORY_MIN_HUMAN_COUNT: 5,

    // 失败条件
    DEFEAT_MAX_AI_COUNT: 5,

    // 最多能误杀的人类数量
    MAX_HUMAN_KILLED: 3
};

// ==================== 动画时长 ====================

export const ANIMATION_DURATION = {
    // Toast 显示时长 (毫秒)
    TOAST_DURATION: 2000,

    // 浮动伤害显示时长
    FLOATING_DAMAGE_DURATION: 1000,

    // 攻击警告持续时间
    ATTACK_WARNING_DURATION: 5000,

    // 淘汰动画阶段时长
    ELIMINATION: {
        GRAB: 300,   // 机械手伸入
        PULL: 200,   // 抓住
        EXIT: 300    // 拖出
    },

    // 鱼入场动画时长
    FISH_ENTER: 300,

    // 鱼离场动画时长
    FISH_EXIT: 500
};

// ==================== 物理参数 ====================

export const PHYSICS_CONFIG = {
    // 鱼的位置范围
    BOUNDS: {
        MIN_X: 60,
        MAX_X: 340,
        MIN_Y: 60,
        MAX_Y: 440
    },

    // 速度范围
    VELOCITY: {
        MIN_VX: 0.8,
        MAX_VX: 1.5,
        MIN_VY: -0.2,
        MAX_VY: 0.2
    },

    // 缩放范围
    SCALE: {
        MIN: 0.8,
        MAX: 1.2
    },

    // 旋转范围 (度)
    ROTATION: {
        MIN: -5,
        MAX: 5
    },

    // 浮动参数
    FLOAT: {
        AMPLITUDE: 12,      // 浮动幅度
        SPEED_MIN: 0.6,     // 最小浮动速度
        SPEED_MAX: 1.4      // 最大浮动速度
    }
};

// ==================== UI 配置 ====================

export const UI_CONFIG = {
    // Toast 最大数量
    MAX_TOAST_COUNT: 5,

    // 浮动伤害最大数量
    MAX_FLOATING_DAMAGE: 20,

    // 画布尺寸 (用于绘画系统)
    CANVAS: {
        WIDTH: 300,
        HEIGHT: 300
    }
};

// ==================== 绘画系统配置 ====================

export const DRAWING_CONFIG = {
    // 笔刷大小
    BRUSH_SIZE: {
        OUTLINE: 10,
        FILL: 10
    },

    // 颜色配置
    COLORS: {
        OUTLINE: '#000000',  // 勾边颜色 (固定黑色)
        FILL_PALETTE: [
            '#000000',  // 黑色
            '#FF2A2A',  // 红色
            '#1F75FE',  // 蓝色
            '#00CC44',  // 绿色
            '#FF9900'   // 橙色
        ]
    },

    // 历史记录最大步数
    MAX_HISTORY: 5,

    // 导出图片最小尺寸
    MIN_EXPORT_SIZE: 80,

    // 导出图片目标尺寸
    TARGET_EXPORT_SIZE: 120,

    // 裁剪边距
    CROP_PADDING: 10,

    // 手绘抖动强度 (0-1)
    WOBBLE_INTENSITY: 0.3
};

// ==================== 气泡配置 ====================

export const BUBBLE_CONFIG = {
    // 气泡数量
    COUNT: 15,

    // 缩放范围
    SCALE: {
        MIN: 0.5,
        MAX: 1.5
    },

    // 上浮时长范围 (秒)
    DURATION: {
        MIN: 4,
        MAX: 8
    },

    // 初始延迟范围 (秒)
    DELAY: {
        MIN: 0,
        MAX: 5
    },

    // 水平漂移量
    DRIFT_X: 30
};

// ==================== 投票系统配置 ====================

export const VOTE_CONFIG = {
    // 动态投票阈值 = 在线人数 × 此比例
    THRESHOLD_RATIO: 0.3,

    // 游戏结束的最少物品数
    MIN_ITEMS_FOR_GAME_END: 6  // 5人 + 1AI
};

// ==================== 网络配置 ====================

export const NETWORK_CONFIG = {
    // WebSocket 重连延迟 (毫秒)
    RECONNECT_DELAY: 1000,

    // 重连最大尝试次数
    RECONNECT_ATTEMPTS: 5,

    // 请求超时时间 (毫秒)
    REQUEST_TIMEOUT: 10000
};

// ==================== 平台适配 ====================

export const PLATFORM = {
    // 微信小游戏 AppID (需要用户填写)
    WECHAT_APP_ID: '',

    // 分享配置
    SHARE: {
        TITLE: '反向图灵测试 - 找出AI画的鱼！',
        DESC: '来挑战一下，看你能不能分辨出哪条鱼是AI画的！',
        IMAGE_URL: ''  // 分享图片URL
    }
};
