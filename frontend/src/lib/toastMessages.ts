/**
 * Toast 随机文案库
 * 基于 PRD v2.0
 */

import { ToastType } from '@/types/battle'

// 捕获 AI 成功的文案
export const KILL_AI_MESSAGES = [
  '🎯 干得漂亮！成功揪出一只 AI！',
  '🦈 AI 已被清除！继续保持！',
  '✨ 火眼金睛！AI 无处遁形！',
  '🎉 精准打击！AI 落网！',
  '💪 好样的！又少了一只 AI！',
  '🔥 完美判断！AI 原形毕露！',
  '🏆 MVP 预定！精准识别 AI！',
  '⚡ 闪电出击！AI 已淘汰！',
]

// 误杀人类的文案
export const KILL_HUMAN_MESSAGES = [
  '😱 糟糕！误伤友军！',
  '💔 不！那是自己人！',
  '😰 冤枉好人了...',
  '🙈 呃...这下尴尬了',
  '😢 人类同胞倒下了...',
  '💀 友军火力！停止射击！',
  '🤦 判断失误，痛失队友',
  '😓 这不是 AI 啊...',
]

// 自己被抓的文案
export const SELF_CAUGHT_MESSAGES = [
  '😵 你被淘汰了！',
  '💀 出局！下次小心点...',
  '🎭 身份暴露，游戏结束',
  '😔 你的旅程到此为止了',
]

// 被攻击时的警告文案
export const BEING_ATTACKED_MESSAGES = [
  '⚠️ 有人在瞄准你！',
  '🎯 危险！你正在被投票！',
  '❗ 警告！你成为了目标！',
  '🔴 小心！有人在针对你！',
]

// 通用信息文案
export const INFO_MESSAGES = [
  '📢 新的情报！',
  '💡 注意！',
  'ℹ️ 提示：',
]

// 根据类型获取随机文案
export function getRandomMessage(type: ToastType): string {
  let messages: string[]

  switch (type) {
    case 'kill_ai':
      messages = KILL_AI_MESSAGES
      break
    case 'kill_human':
      messages = KILL_HUMAN_MESSAGES
      break
    case 'self_caught':
      messages = SELF_CAUGHT_MESSAGES
      break
    case 'being_attacked':
      messages = BEING_ATTACKED_MESSAGES
      break
    case 'info':
    default:
      messages = INFO_MESSAGES
      break
  }

  return messages[Math.floor(Math.random() * messages.length)]
}

// 生成击杀 Toast 内容
export function generateKillToast(fishName: string, isAI: boolean): string {
  const baseMessage = getRandomMessage(isAI ? 'kill_ai' : 'kill_human')
  return `${baseMessage}\n「${fishName}」已被淘汰`
}

// 生成被攻击警告内容
export function generateAttackWarning(): string {
  return getRandomMessage('being_attacked')
}

// 生成自己被抓的内容
export function generateSelfCaughtToast(fishName: string): string {
  const baseMessage = getRandomMessage('self_caught')
  return `${baseMessage}\n你的「${fishName}」被淘汰了`
}
