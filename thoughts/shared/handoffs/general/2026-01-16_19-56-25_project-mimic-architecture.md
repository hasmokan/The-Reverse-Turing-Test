---
date: 2026-01-16T19:56:25+08:00
researcher: Antigravity
git_commit: 343678e5e0574925d567635199327b5c7defc8b2
branch: main
repository: who-is-undercover
topic: "Project Mimic 实施架构文档创建"
tags: [implementation, architecture, game, ai-generation, websocket]
status: complete
last_updated: 2026-01-16
last_updated_by: Antigravity
type: implementation_strategy
---

# Handoff: Project Mimic (谁是卧底) 架构设计

## Task(s)

| 任务 | 状态 |
|------|------|
| 阅读 PRD 文档 (谁是卧底.md) | ✅ 完成 |
| 阅读技术框架参考 | ✅ 完成 |
| 阅读架构参考 (README_Wallpaper.md) | ✅ 完成 |
| 创建 superpowers skill 的 SKILL.md 和 AGENTS.md | ✅ 完成 |
| 创建 Project Mimic 实施架构文档 | ✅ 完成 |
| 架构文档审阅 | 🔄 等待用户反馈 |

## Critical References

- PRD 文档: `谁是卧底.md` - 完整的产品需求，包含游戏规则、前后端功能需求、AI 服务需求
- 架构参考: `README_Wallpaper.md` - n8n + Rust 架构模式参考
- 实施架构: `docs/plans/2026-01-16-project-mimic-architecture.md` - 本次创建的架构文档

## Recent changes

1. **创建 superpowers skill 文档**
   - `/Users/kina/Code/Agent/who-is-undercover/.agent/skills/superpowers/SKILL.md` - 概览索引
   - `/Users/kina/Code/Agent/who-is-undercover/.agent/skills/superpowers/AGENTS.md` - 完整参考

2. **创建 Project Mimic 实施架构文档**
   - `docs/plans/2026-01-16-project-mimic-architecture.md` - 完整架构设计

## Learnings

### 架构决策

1. **WebSocket 必要性** - 用户提问为何需要 WebSocket，原因：
   - 实时多人同步 (物体位置、作品、投票)
   - 50+ 物体高频位置更新
   - 60 秒投票倒计时同步
   - 淘汰/爆炸事件即时广播

2. **AI 伪装关键点** - PRD 中强调的 "色彩映射" 是防止 AI 暴露的关键
   - 用户色板被限制 (3-5 色)
   - AI 生成后必须做 Color Quantization 映射到相同色板

3. **架构复用** - 参考 `README_Wallpaper.md` 的 n8n + Rust 模式
   - Rust 作为 API 网关 + WebSocket 服务
   - n8n 编排 AI 生成流程 (SD → rembg → 色彩映射 → LLM 元数据)

## Artifacts

- `docs/plans/2026-01-16-project-mimic-architecture.md` - 实施架构文档
  - 架构概览图
  - 数据库设计 (5 张表): themes, rooms, drawings, votes, ai_tasks
  - REST API 设计
  - WebSocket 事件定义
  - n8n 工作流设计 + Prompt 模板
  - 项目目录结构
  - 4 阶段实施计划 (共 6 周)

- `.agent/skills/superpowers/SKILL.md` - 技能概览索引
- `.agent/skills/superpowers/AGENTS.md` - 14 个子技能完整参考

## Action Items & Next Steps

1. **[ ] 用户审阅架构文档** - 等待反馈
   - 架构设计是否符合预期
   - 数据库表结构是否需要调整
   - 实施阶段优先级是否正确

2. **[ ] 确认技术选型**
   - 前端框架: React/Vue?
   - 部署环境: 阿里云/腾讯云?
   - SD 模型: Turbo 还是其他?

3. **[ ] 进入 Phase 1 POC 开发**
   - 初始化 Rust 项目
   - 初始化前端项目
   - 数据库迁移脚本

## Other Notes

### PRD 关键数字

- 色板: 3-5 种颜色
- 名称: ≤ 8 字
- 介绍: ≤ 20 字
- 投票时长: 60 秒
- AI 生成触发: 每 5 个用户作品生成 1 个 AI
- 爆炸阈值: AI 数量 > 5

### 实施阶段概览

| 阶段 | 时长 | 目标 |
|------|------|------|
| Phase 1 POC | 2 周 | 绘画→展示→投票基础流程 |
| Phase 2 AI 集成 | 2 周 | 真实 AI 生成 |
| Phase 3 优化 | 1 周 | 色彩映射 + 内容审核 |
| Phase 4 多主题 | 1 周 | 主题扩展系统 |
