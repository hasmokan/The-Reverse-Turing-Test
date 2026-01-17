/**
 * 战斗系统常量配置
 * 基于 PRD v2.0
 */

// CD 时间 (毫秒)
export const COOLDOWN_DURATION = 7500 // 7.5 秒

// 处决阈值
export const ELIMINATION_THRESHOLD = 4 // 累计 4 票触发处决

// 攻击警告持续时间 (毫秒)
export const ATTACK_WARNING_DURATION = 5000 // 5 秒

// Toast 显示时间 (毫秒)
export const TOAST_DURATION = 2000 // 2 秒

// 最大 Toast 数量
export const MAX_TOAST_COUNT = 3

// 漂浮数字持续时间 (毫秒)
export const FLOATING_DAMAGE_DURATION = 1000 // 1 秒

// 处决动画时长 (毫秒)
export const ELIMINATION_ANIMATION_DURATION = {
  grab: 300,  // 机械手伸入
  pull: 200,  // 抓住
  exit: 300,  // 拖出
}

// 胜负判定条件
export const VICTORY_CONDITION = {
  aiRemaining: 0,      // AI 全部清除
  minHumanCount: 5,    // 人类存活 >= 5
}

export const DEFEAT_CONDITION = {
  maxAiCount: 5,       // AI 数量 > 5 时失败
}

// 动画配置
export const ANIMATION_CONFIG = {
  toast: {
    enter: { duration: 0.2, type: 'spring', bounce: 0.5 },
    stay: 2000,
    exit: { duration: 0.3 },
  },
  attackWarning: {
    breatheDuration: 1.5, // 呼吸动画周期
    minOpacity: 0.3,
    maxOpacity: 0.6,
  },
  floatingDamage: {
    riseDistance: 50, // 上升距离
    duration: 1,
  },
  grabEffect: {
    grabDuration: 0.3,
    pullDuration: 0.2,
    exitDuration: 0.3,
  },
  confetti: {
    particleCount: 100,
    spread: 70,
    duration: 3000,
  },
  crack: {
    duration: 0.5,
    fadeOutDelay: 2000,
  },
}

// 颜色配置
export const BATTLE_COLORS = {
  killAi: {
    bg: 'bg-green-500',
    text: 'text-green-500',
    border: 'border-green-500',
    gradient: 'from-green-500 to-emerald-600',
  },
  killHuman: {
    bg: 'bg-red-500',
    text: 'text-red-500',
    border: 'border-red-500',
    gradient: 'from-red-500 to-rose-600',
  },
  warning: {
    bg: 'bg-orange-500',
    text: 'text-orange-500',
    border: 'border-orange-500',
    gradient: 'from-orange-500 to-amber-600',
  },
  chase: {
    bg: 'bg-purple-500',
    text: 'text-purple-500',
    border: 'border-purple-500',
    gradient: 'from-purple-500 to-violet-600',
  },
  cooldownReady: {
    bg: 'bg-red-500',
    glow: 'shadow-red-500/50',
  },
  cooldownActive: {
    bg: 'bg-gray-400',
  },
}
