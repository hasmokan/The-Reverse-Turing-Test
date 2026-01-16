# Project Mimic (谁是卧底) 实施架构文档

## 概述

基于 **UGC vs AIGC** 对抗的多人在线休闲游戏。用户手绘涂鸦汇入公共场景，AI 生成模仿人类画风的"卧底"混入其中，玩家通过投票找出 AI。

**核心体验**: 极低创作门槛 + 推理博弈紧张感 + 图灵测试变体

---

## 架构概览

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────────────────┐
│   移动端 H5      │────▶│   Rust API 服务   │────▶│            n8n 工作流                │
│  (React/Vue)    │◀───│   (WebSocket)    │◀───│  ┌──────┐  ┌──────┐  ┌──────────┐  │
│                 │     └────────┬─────────┘     │  │SD生图 │→│rembg │→│色彩映射  │  │
│  ┌───────────┐  │              │               │  └──────┘  └──────┘  └──────────┘  │
│  │ Canvas    │  │              ▼               │                                     │
│  │ 绘画板    │  │     ┌──────────────┐         └──────┬──────────────────────────────┘
│  └───────────┘  │     │   PostgreSQL │                │
│  ┌───────────┐  │     │   + Redis    │                ▼
│  │ Stage     │  │     └──────────────┘         ┌──────────────┐
│  │ 公共场景  │  │                              │   OSS 存储    │
│  └───────────┘  │                              │   (图片资源)   │
└─────────────────┘                              └──────────────┘
```

---

## 数据库设计 (PostgreSQL)

### 表结构

```sql
-- 主题配置表
CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id VARCHAR(50) UNIQUE NOT NULL,      -- "fishtank_01"
    theme_name VARCHAR(100) NOT NULL,           -- "深海鱼缸"
    background_url TEXT NOT NULL,
    particle_effect VARCHAR(50),                -- "bubble", "steam"
    palette JSONB NOT NULL,                     -- ["#FF6B6B", "#4ECDC4", "#45B7D1"]
    ai_keywords JSONB NOT NULL,                 -- ["fish", "whale", "shark"]
    ai_prompt_style TEXT NOT NULL,              -- "children's drawing, scribble..."
    spawn_rate INT DEFAULT 5,                   -- 每 N 个用户作品生成 1 个 AI
    max_imposters INT DEFAULT 5,                -- 爆炸阈值
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 房间表
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES themes(id) NOT NULL,
    room_code VARCHAR(10) UNIQUE NOT NULL,      -- 房间邀请码
    status VARCHAR(20) DEFAULT 'active',        -- active, voting, gameover
    total_items INT DEFAULT 0,
    ai_count INT DEFAULT 0,
    turbidity FLOAT DEFAULT 0.0,                -- 浑浊度 0.0-1.0
    voting_ends_at TIMESTAMPTZ,                 -- 投票截止时间
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 绘画作品表
CREATE TABLE drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    is_ai BOOLEAN DEFAULT FALSE,
    
    -- 图片信息
    image_url TEXT NOT NULL,                    -- OSS URL
    thumbnail_url TEXT,
    
    -- 元数据
    name VARCHAR(10) NOT NULL,                  -- 限制 8 字
    description VARCHAR(25),                    -- 限制 20 字
    author_name VARCHAR(50) DEFAULT '匿名艺术家',
    
    -- 显示状态
    position_x FLOAT DEFAULT 0.5,               -- 0.0-1.0 相对位置
    position_y FLOAT DEFAULT 0.5,
    velocity_x FLOAT DEFAULT 0.0,
    velocity_y FLOAT DEFAULT 0.0,
    rotation FLOAT DEFAULT 0.0,
    scale FLOAT DEFAULT 1.0,
    flip_x BOOLEAN DEFAULT FALSE,
    
    -- 投票信息
    vote_count INT DEFAULT 0,
    is_eliminated BOOLEAN DEFAULT FALSE,
    eliminated_at TIMESTAMPTZ,
    
    -- 举报信息
    report_count INT DEFAULT 0,
    is_hidden BOOLEAN DEFAULT FALSE,
    
    -- Session 追踪
    session_id VARCHAR(100),                    -- 匿名用户 session
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 投票记录表
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID REFERENCES drawings(id) NOT NULL,
    session_id VARCHAR(100) NOT NULL,           -- 投票者 session
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(drawing_id, session_id)              -- 防止重复投票
);

-- AI 生成任务表
CREATE TABLE ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    drawing_id UUID REFERENCES drawings(id),
    
    status VARCHAR(20) DEFAULT 'pending',       -- pending, generating, processing, completed, failed
    
    -- n8n 工作流追踪
    n8n_execution_id VARCHAR(100),
    
    -- 生成参数
    prompt TEXT,
    negative_prompt TEXT,
    keyword VARCHAR(50),
    
    -- 处理结果
    raw_image_url TEXT,                         -- SD 原始输出
    final_image_url TEXT,                       -- 去背 + 色彩映射后
    generated_name VARCHAR(10),
    generated_description VARCHAR(25),
    
    error_message TEXT,
    retry_count INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_rooms_theme ON rooms(theme_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_drawings_room ON drawings(room_id);
CREATE INDEX idx_drawings_room_active ON drawings(room_id) WHERE is_eliminated = FALSE AND is_hidden = FALSE;
CREATE INDEX idx_votes_drawing ON votes(drawing_id);
CREATE INDEX idx_ai_tasks_room ON ai_tasks(room_id);
CREATE INDEX idx_ai_tasks_status ON ai_tasks(status);
```

---

## API 设计 (Rust Axum)

### REST API

```yaml
# 主题
GET  /api/themes                      # 获取所有可用主题
GET  /api/themes/{theme_id}           # 获取主题详情

# 房间
POST /api/rooms                       # 创建房间 { theme_id }
GET  /api/rooms/{room_code}           # 获取房间状态
GET  /api/rooms/{room_code}/drawings  # 获取房间内所有作品

# 绘画
POST /api/rooms/{room_code}/drawings  # 提交绘画
     Content-Type: multipart/form-data
     - image: PNG file (with alpha)
     - name: string (max 8 chars)
     - description: string (max 20 chars)
     - session_id: string

GET  /api/drawings/{drawing_id}       # 获取作品详情

# 投票
POST /api/drawings/{drawing_id}/vote  # 投票 { session_id }
POST /api/drawings/{drawing_id}/report # 举报 { session_id, reason }

# n8n 回调
POST /api/n8n/callback                # AI 生成完成回调
POST /api/n8n/progress                # AI 生成进度更新
```

### WebSocket 事件

```yaml
# 连接
ws://host/ws/rooms/{room_code}?session_id={session_id}

# 服务端推送事件
Event: room_state                     # 初始房间状态
{
  "type": "room_state",
  "data": {
    "room": {...},
    "drawings": [...],
    "theme": {...}
  }
}

Event: drawing_added                  # 新作品加入
{
  "type": "drawing_added",
  "data": { "drawing": {...} }
}

Event: drawing_moved                  # 作品位置更新 (高频)
{
  "type": "drawing_moved",
  "data": { 
    "id": "uuid",
    "x": 0.5, "y": 0.3,
    "vx": 0.01, "vy": -0.02,
    "flip_x": true
  }
}

Event: vote_updated                   # 投票数更新
{
  "type": "vote_updated",
  "data": { "drawing_id": "uuid", "vote_count": 15 }
}

Event: voting_started                 # 投票环节开始
{
  "type": "voting_started",
  "data": { "ends_at": "2026-01-16T20:00:00Z" }
}

Event: drawing_eliminated             # 作品被淘汰
{
  "type": "drawing_eliminated",
  "data": { 
    "drawing_id": "uuid",
    "was_ai": true,
    "animation": "capture"            # capture | wrongful_death
  }
}

Event: ai_spawned                     # AI 卧底出现 (不透露是哪个)
{
  "type": "ai_spawned",
  "data": { "ai_count": 3 }
}

Event: turbidity_changed              # 浑浊度变化
{
  "type": "turbidity_changed", 
  "data": { "level": 0.4 }
}

Event: game_over                      # 游戏结束
{
  "type": "game_over",
  "data": { 
    "reason": "ai_overrun",
    "final_ai_count": 6,
    "animation": "explosion"
  }
}
```

---

## n8n 工作流设计

### Webhook 触发

```
POST /webhook/mimic-ai-generate
{
  "room_id": "uuid",
  "task_id": "uuid",
  "theme": {
    "palette": ["#FF6B6B", "#4ECDC4", "#45B7D1"],
    "keywords": ["fish", "whale", "shark"],
    "prompt_style": "children's drawing, scribble, thick marker lines"
  },
  "callback_url": "http://rust-service/api/n8n/callback"
}
```

### 工作流节点

```
┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌────────────┐
│ Webhook  │──▶│ Random     │──▶│ SD Generate │──▶│ Wait Loop  │
│ Trigger  │   │ Keyword    │   │ (Turbo)     │   │ (轮询)     │
└──────────┘   └────────────┘   └─────────────┘   └────────────┘
                                                        │
      ┌──────────────────────────────────────────────────┘
      ▼
┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌────────────┐
│ Download │──▶│ rembg      │──▶│ Color       │──▶│ Upload     │
│ Image    │   │ (去背)     │   │ Quantize    │   │ to OSS     │
└──────────┘   └────────────┘   └─────────────┘   └────────────┘
                                                        │
      ┌──────────────────────────────────────────────────┘
      ▼
┌──────────┐   ┌────────────┐   ┌─────────────┐
│ LLM      │──▶│ Generate   │──▶│ Callback    │
│ (名称)   │   │ Metadata   │   │ to Rust     │
└──────────┘   └────────────┘   └─────────────┘
```

### Prompt 模板

```python
# 图像生成 Prompt
POSITIVE_PROMPT = """
{keyword}, {theme_prompt_style},
wobbly strokes, thick outlines, marker pen,
using only colors: {palette_colors},
simple flat color, no shading, no gradient,
white background for easy removal
"""

NEGATIVE_PROMPT = """
realistic, 3d, photorealism, perfect symmetry,
complex details, shading, gradient,
professional art, high quality
"""

# 元数据生成 Prompt
METADATA_PROMPT = """
你是一个不会画画的普通人，刚刚在手机上随便画了一个丑丑的 {keyword}。
请用简短、口语化、甚至有点敷衍的语气给它：
1. 起个名字（5字以内）
2. 写个介绍（15字以内）

返回 JSON 格式：
{"name": "xxx", "description": "xxx"}
"""
```

---

## 项目结构

```
who-is-undercover/
├── frontend/                        # H5 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas/             # 绘画板组件
│   │   │   │   ├── DrawingCanvas.tsx
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   └── ColorPalette.tsx
│   │   │   ├── Stage/              # 公共场景组件
│   │   │   │   ├── GameStage.tsx   # Pixi.js 渲染
│   │   │   │   ├── DrawingSprite.tsx
│   │   │   │   └── Effects.tsx     # 浑浊度、爆炸
│   │   │   ├── UI/
│   │   │   │   ├── DetailModal.tsx
│   │   │   │   ├── VotingBar.tsx
│   │   │   │   └── StatusCounter.tsx
│   │   │   └── Room/
│   │   │       ├── RoomLobby.tsx
│   │   │       └── ThemeSelector.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useDrawingMotion.ts # 物体运动计算
│   │   │   └── useGameState.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── websocket.ts
│   │   └── App.tsx
│   └── package.json
│
├── backend/                         # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── config.rs
│   │   ├── routes/
│   │   │   ├── mod.rs
│   │   │   ├── themes.rs
│   │   │   ├── rooms.rs
│   │   │   ├── drawings.rs
│   │   │   └── n8n_callback.rs
│   │   ├── ws/
│   │   │   ├── mod.rs
│   │   │   ├── handler.rs
│   │   │   └── messages.rs
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── room_manager.rs     # 房间状态管理
│   │   │   ├── game_logic.rs       # 游戏逻辑
│   │   │   ├── motion_engine.rs    # 物体运动计算
│   │   │   ├── n8n_client.rs       # 触发 n8n 工作流
│   │   │   ├── oss.rs              # OSS 上传
│   │   │   └── content_moderation.rs # 内容审核
│   │   ├── models/
│   │   │   ├── mod.rs
│   │   │   ├── theme.rs
│   │   │   ├── room.rs
│   │   │   ├── drawing.rs
│   │   │   └── ai_task.rs
│   │   └── db/
│   │       ├── mod.rs
│   │       └── migrations/
│   ├── Cargo.toml
│   └── Dockerfile
│
├── n8n-workflow/
│   └── mimic-ai-workflow.json
│
├── docker-compose.yml
└── docs/
    └── plans/
        └── 2026-01-16-project-mimic-architecture.md
```

---

## 实施阶段

### Phase 1: POC 核心循环 (2 周)

**目标**: 跑通绘画→展示→投票基础流程

#### 1.1 基础设施

- [ ] 初始化 Rust 项目 (Axum + SQLx)
- [ ] PostgreSQL 数据库 + 迁移脚本
- [ ] Redis 连接 (房间状态缓存)
- [ ] Docker Compose 开发环境

#### 1.2 后端 API

- [ ] 主题 CRUD
- [ ] 房间创建/加入
- [ ] 绘画上传 (暂用本地存储)
- [ ] WebSocket 基础连接

#### 1.3 前端基础

- [ ] React/Vite 项目初始化
- [ ] Canvas 绘画板 (基础笔刷、颜色)
- [ ] Stage 场景渲染 (Pixi.js)
- [ ] WebSocket 集成

#### 1.4 投票系统

- [ ] 投票 API
- [ ] 投票计数 + 淘汰逻辑
- [ ] 淘汰动画

#### 验收标准

- [ ] 用户可以绘画并提交
- [ ] 作品在场景中随机游动
- [ ] 可以投票并看到淘汰动画
- [ ] 手动插入 AI 图片测试流程

---

### Phase 2: AI 集成 (2 周)

**目标**: 接入真实 AI 生成

#### 2.1 n8n 工作流

- [ ] SD Turbo 图像生成节点
- [ ] rembg 去背处理
- [ ] LLM 元数据生成
- [ ] 回调 Rust 服务

#### 2.2 OSS 集成

- [ ] 阿里云 OSS 配置
- [ ] 图片上传服务
- [ ] URL 签名

#### 2.3 触发逻辑

- [ ] 物体计数触发器 (Total % 5 == 0)
- [ ] AI 任务队列
- [ ] 失败重试机制

#### 验收标准

- [ ] 每 5 个用户作品自动生成 1 个 AI
- [ ] AI 图片风格接近用户涂鸦
- [ ] AI 名称/介绍自然

---

### Phase 3: 优化与安全 (1 周)

**目标**: 提升体验 + 内容安全

#### 3.1 色彩映射

- [ ] 色值量化算法
- [ ] 集成到 n8n 工作流

#### 3.2 内容审核

- [ ] 阿里云内容安全 API
- [ ] 违规拦截逻辑
- [ ] 举报处理队列

#### 3.3 性能优化

- [ ] WebSocket 消息批处理
- [ ] 前端 Canvas 渲染优化
- [ ] 服务端运动计算共享

#### 验收标准

- [ ] AI 图片色彩与用户一致
- [ ] 违规图片被拦截
- [ ] 50+ 物体流畅渲染

---

### Phase 4: 多主题支持 (1 周)

**目标**: 主题扩展系统

#### 4.1 主题配置

- [ ] 完善主题 JSON 结构
- [ ] 主题切换 UI
- [ ] 主题特效 (粒子、背景)

#### 4.2 新主题上线

- [ ] 混乱咖啡厅主题
- [ ] 森林动物主题

#### 验收标准

- [ ] 可配置新增主题
- [ ] 不同主题有不同视觉风格

---

## 技术选型

| 组件 | 技术选择 | 理由 |
|------|----------|------|
| 前端框架 | React + Vite | 快速开发，移动端友好 |
| Canvas 渲染 | Pixi.js | 高性能 2D 渲染，支持复杂动画 |
| 后端框架 | Rust Axum | 高性能 WebSocket，与壁纸项目复用 |
| 数据库 | PostgreSQL | JSONB 支持配置，可靠 |
| 缓存 | Redis | 房间状态实时同步 |
| 工作流 | n8n | 可视化编排 AI 流程 |
| 图像生成 | SD Turbo | 快速生成，适合实时场景 |
| 去背 | rembg | 开源可靠 |
| 存储 | 阿里云 OSS | 国内访问快 |
| 内容审核 | 阿里云内容安全 | 接入简单 |

---

## 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| AI 画风太完美 | 太容易识别 | 增加噪点、抖动后处理 |
| AI 画风太差 | 破坏体验 | 预设图库兜底 |
| UGC 违规内容 | 法律风险 | 内容审核 + 举报机制 |
| WebSocket 高并发 | 卡顿 | Redis Pub/Sub + 分房间 |
| AI 生成延迟 | 体验中断 | 预生成队列缓冲 |

---

## 参考资料

- PRD: `谁是卧底.md`
- 架构参考: `README_Wallpaper.md`
- n8n 文档: https://docs.n8n.io/
- Pixi.js: https://pixijs.com/
- rembg: https://github.com/danielgatis/rembg
