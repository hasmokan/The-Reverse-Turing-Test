# Project Mimic (谁是卧底) MVP 实施架构文档

## 概述

基于 **UGC vs AIGC** 对抗的多人在线休闲游戏。用户手绘涂鸦汇入公共场景，AI 生成模仿人类画风的"卧底"混入其中，玩家通过投票找出 AI。

**核心体验**: 极低创作门槛 + 推理博弈紧张感 + 图灵测试变体

**MVP 原则**: 最小依赖、快速验证、预留扩展

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Project Mimic MVP 架构                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐                    ┌────────────────────────────┐ │
│   │   Next.js   │ ─── REST API ────▶ │        Rust 服务           │ │
│   │   前端      │ ◀── WebSocket ──── │                            │ │
│   │  (已完成)   │                    │  • 接收 Base64 图片        │ │
│   └─────────────┘                    │  • 存入 PostgreSQL         │ │
│                                      │  • WebSocket 实时广播      │ │
│                                      │  • 触发 n8n AI 生成        │ │
│                                      └─────────────┬──────────────┘ │
│                                                    │                │
│                          ┌─────────────────────────┴─────────┐      │
│                          ▼                                   ▼      │
│                  ┌──────────────┐                   ┌──────────┐   │
│                  │  PostgreSQL  │                   │  Redis   │   │
│                  │              │                   │          │   │
│                  │ • themes     │                   │ 房间状态 │   │
│                  │ • rooms      │                   │ 在线用户 │   │
│                  │ • drawings   │ ← Base64 图片     │ 位置缓存 │   │
│                  │ • votes      │                   │          │   │
│                  │ • ai_tasks   │                   │          │   │
│                  └──────────────┘                   └──────────┘   │
│                                                                     │
│   ════════════════════════════════════════════════════════════════ │
│                    n8n AI 生成工作流 (精简版)                       │
│   ════════════════════════════════════════════════════════════════ │
│                                                                     │
│   ┌──────────┐    ┌─────────────────┐    ┌──────────────────────┐  │
│   │ Webhook  │───▶│ Zenmux API      │───▶│ Callback 回调        │  │
│   │ Trigger  │    │ nano-banana Pro │    │ Rust 服务            │  │
│   └──────────┘    │ + LLM 元数据    │    └──────────────────────┘  │
│                   └─────────────────┘                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 技术选型

| 组件 | 技术选择 | 理由 |
|------|----------|------|
| 前端框架 | Next.js 15 + React 19 | ✅ 已完成 |
| 状态管理 | Zustand | ✅ 已完成 |
| 动画 | Framer Motion | ✅ 已完成 |
| 实时通信 | Socket.IO | ✅ 已完成 |
| 后端框架 | Rust Axum | 高性能 WebSocket |
| 数据库 | PostgreSQL | JSONB 支持，可靠 |
| 缓存 | Redis | 房间状态实时同步 |
| 工作流 | n8n | 可视化编排 AI 流程 |
| 图像生成 | Zenmux nano-banana Pro | Gemini 3 Pro Image |
| LLM | Zenmux GPT-4o-mini | 生成名称/介绍 |
| 图片存储 | PostgreSQL (Base64) | MVP 简化，无需 OSS |

---

## 数据库设计 (PostgreSQL)

### 表结构

```sql
-- 主题配置表
CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id VARCHAR(50) UNIQUE NOT NULL,      -- "fish_tank_01"
    theme_name VARCHAR(100) NOT NULL,           -- "深海鱼缸"
    background_url TEXT NOT NULL,
    particle_effect VARCHAR(50),                -- "bubbles", "steam"
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
    online_count INT DEFAULT 0,                 -- 在线人数 (用于动态投票阈值)
    turbidity FLOAT DEFAULT 0.0,                -- 浑浊度 0.0-1.0
    voting_started_at TIMESTAMPTZ,              -- 投票开始时间
    voting_ends_at TIMESTAMPTZ,                 -- 投票截止时间
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 绘画作品表 (Base64 存储)
CREATE TABLE drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    is_ai BOOLEAN DEFAULT FALSE,
    
    -- 图片信息 (Base64 存储)
    image_data TEXT NOT NULL,                   -- data:image/png;base64,xxx
    
    -- 元数据
    name VARCHAR(24) NOT NULL,                  -- 8 中文字 (UTF-8)
    description VARCHAR(60),                    -- 20 中文字 (UTF-8)
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

-- 举报记录表
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID REFERENCES drawings(id) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(drawing_id, session_id)              -- 防止重复举报
);

-- AI 生成任务表
CREATE TABLE ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    drawing_id UUID REFERENCES drawings(id),
    
    status VARCHAR(20) DEFAULT 'pending',       -- pending, generating, completed, failed
    
    -- n8n 工作流追踪
    n8n_execution_id VARCHAR(100),
    
    -- 生成参数
    prompt TEXT,
    keyword VARCHAR(50),
    
    -- 处理结果
    image_data TEXT,                            -- Base64 结果
    generated_name VARCHAR(24),
    generated_description VARCHAR(60),
    
    error_message TEXT,
    retry_count INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_rooms_theme ON rooms(theme_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_drawings_room ON drawings(room_id);
CREATE INDEX idx_drawings_room_active ON drawings(room_id) 
    WHERE is_eliminated = FALSE AND is_hidden = FALSE;
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
GET  /api/rooms/{room_code}/drawings  # 获取房间内所有作品 (不含 image_data)

# 绘画 (Base64)
POST /api/rooms/{room_code}/drawings  # 提交绘画
     Content-Type: application/json
     {
       "image_data": "data:image/png;base64,...",
       "name": "我的丑鱼",
       "description": "随便画的",
       "session_id": "xxx"
     }
     
     Response:
     {
       "id": "uuid",
       "image_data": "data:image/png;base64,...",
       "name": "我的丑鱼",
       "position": { "x": 0.5, "y": 0.5 },
       "created_at": "2026-01-16T20:00:00Z"
     }

GET  /api/drawings/{drawing_id}       # 获取作品详情 (含 image_data)
GET  /api/drawings/{drawing_id}/image # 单独获取图片 Base64

# 投票
POST /api/drawings/{drawing_id}/vote  # 投票 { session_id }
POST /api/drawings/{drawing_id}/report # 举报 { session_id, reason }

# n8n 回调
POST /api/n8n/callback                # AI 生成完成回调
```

### WebSocket 事件

```yaml
# 连接
ws://host/ws/rooms/{room_code}?session_id={session_id}

# 服务端推送事件
Event: room_state                     # 初始房间状态 (不含 image_data)
{
  "type": "room_state",
  "data": {
    "room": { ... },
    "drawings": [
      { "id": "uuid", "name": "xxx", "position": {...}, ... }
    ],
    "theme": { ... }
  }
}

Event: drawing_added                  # 新作品加入 (不含 image_data)
{
  "type": "drawing_added",
  "data": { 
    "id": "uuid",
    "name": "xxx",
    "position": { "x": 0.5, "y": 0.5 }
  }
}
# 前端收到后单独请求 GET /api/drawings/{id} 获取图片

Event: position_batch_update          # 批量位置更新 (高频，10fps)
{
  "type": "position_batch_update",
  "data": {
    "items": [
      { "id": "uuid", "x": 0.5, "y": 0.3, "vx": 0.01, "vy": -0.02, "flip_x": true },
      ...
    ]
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
  "data": { 
    "started_at": "2026-01-16T20:00:00Z",
    "ends_at": "2026-01-16T20:01:00Z"
  }
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

Event: online_count                   # 在线人数更新
{
  "type": "online_count",
  "data": { "count": 25 }
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

# 客户端发送事件
Event: player_joined                  # 玩家加入
Event: player_left                    # 玩家离开
```

---

## n8n 工作流设计 (精简版)

### Webhook 触发

```json
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

### 工作流节点 (精简 3 步)

```
┌──────────┐    ┌───────────────────────────┐    ┌────────────────┐
│ Webhook  │───▶│ Zenmux nano-banana Pro    │───▶│ Callback       │
│ Trigger  │    │ + LLM 元数据生成          │    │ 回调 Rust 服务 │
└──────────┘    └───────────────────────────┘    └────────────────┘
```

### 详细节点配置

#### Node 1: Webhook Trigger

```yaml
Type: Webhook
Path: /webhook/mimic-ai-generate
Method: POST
Response Mode: Immediately
```

#### Node 2: Code - 组装 Prompt

```javascript
const input = $input.first().json;
const { theme, task_id, callback_url } = input;

// 随机选择关键词
const keyword = theme.keywords[Math.floor(Math.random() * theme.keywords.length)];
const colors = theme.palette.join(', ');

// 组装 prompt (强调白色背景便于融入场景)
const prompt = `A cute ${keyword}, ${theme.prompt_style}, 
  using only these colors: ${colors}, 
  simple flat color, white background, 
  children's book illustration style, cute and charming`;

return { keyword, prompt, task_id, callback_url };
```

#### Node 3: HTTP Request - Zenmux nano-banana Pro

```yaml
Type: HTTP Request
Method: POST
URL: https://zenmux.ai/api/vertex-ai/v1/models/google/gemini-3-pro-image-preview:generateContent
Headers:
  Authorization: Bearer {{ $credentials.zenmux.apiKey }}
  Content-Type: application/json
Body (JSON):
  {
    "contents": [{
      "parts": [{ "text": "{{ $json.prompt }}" }]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE"],
      "temperature": 0.8
    }
  }
```

#### Node 4: Code - 提取 Base64 图片

```javascript
const response = $input.first().json;
const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

if (!imagePart) {
  throw new Error('No image generated');
}

const base64 = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

return { 
  image_data: base64,
  keyword: $('Code').first().json.keyword,
  task_id: $('Code').first().json.task_id,
  callback_url: $('Code').first().json.callback_url
};
```

#### Node 5: HTTP Request - LLM 生成名称/介绍

```yaml
Type: HTTP Request
Method: POST
URL: https://zenmux.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer {{ $credentials.zenmux.apiKey }}
  Content-Type: application/json
Body (JSON):
  {
    "model": "openai/gpt-4o-mini",
    "messages": [{
      "role": "user",
      "content": "你是一个不会画画的普通人，刚刚在手机上随便画了一个丑丑的{{ $json.keyword }}。请用简短、口语化、甚至有点敷衍的语气给它起个名字（5字以内）和介绍（15字以内）。只返回JSON格式: {\"name\": \"xxx\", \"description\": \"xxx\"}"
    }],
    "temperature": 0.9
  }
```

#### Node 6: Code - 解析 LLM 响应并组装回调数据

```javascript
const prev = $('Code1').first().json;
const llmResponse = $input.first().json.choices[0].message.content;

let metadata;
try {
  metadata = JSON.parse(llmResponse);
} catch (e) {
  // 如果 JSON 解析失败，使用默认值
  metadata = { name: "小东西", description: "随便画的" };
}

return {
  task_id: prev.task_id,
  status: "completed",
  image_data: prev.image_data,
  name: metadata.name.slice(0, 8),           // 确保不超过 8 字
  description: metadata.description.slice(0, 20)  // 确保不超过 20 字
};
```

#### Node 7: HTTP Request - Callback 回调 Rust 服务

```yaml
Type: HTTP Request
Method: POST
URL: {{ $('Code').first().json.callback_url }}
Headers:
  Content-Type: application/json
Body (JSON):
  {
    "task_id": "{{ $json.task_id }}",
    "status": "{{ $json.status }}",
    "image_data": "{{ $json.image_data }}",
    "name": "{{ $json.name }}",
    "description": "{{ $json.description }}"
  }
```

### Prompt 模板

```python
# 图像生成 Prompt
POSITIVE_PROMPT = """
A cute {keyword}, {theme_prompt_style},
using only these colors: {palette_colors},
simple flat color, white background,
children's book illustration style, cute and charming,
wobbly strokes, thick outlines, marker pen
"""

# 元数据生成 Prompt
METADATA_PROMPT = """
你是一个不会画画的普通人，刚刚在手机上随便画了一个丑丑的 {keyword}。
请用简短、口语化、甚至有点敷衍的语气给它：
1. 起个名字（5字以内）
2. 写个介绍（15字以内）

只返回 JSON 格式：
{"name": "xxx", "description": "xxx"}
"""
```

---

## 项目结构

```
who-is-undercover/
├── frontend/                        # Next.js 前端 (已完成)
│   ├── src/
│   │   ├── app/                     # Next.js App Router
│   │   ├── components/
│   │   │   ├── canvas/              # 绘画模块
│   │   │   ├── stage/               # 公共场景模块  
│   │   │   ├── ui/                  # 通用 UI
│   │   │   └── voting/              # 投票相关
│   │   ├── config/                  # 主题配置
│   │   ├── hooks/                   # 自定义 Hooks
│   │   ├── lib/                     # 工具函数、状态管理
│   │   └── types/                   # TypeScript 类型
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
│   │   │   ├── drawings.rs          # 含 Base64 图片处理
│   │   │   └── n8n_callback.rs
│   │   ├── ws/
│   │   │   ├── mod.rs
│   │   │   ├── handler.rs
│   │   │   └── messages.rs
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── room_manager.rs      # 房间状态管理
│   │   │   ├── game_logic.rs        # 游戏逻辑 + AI 触发
│   │   │   ├── motion_engine.rs     # 物体运动计算 (可选)
│   │   │   └── n8n_client.rs        # 触发 n8n 工作流
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
│   └── mimic-ai-workflow.json       # n8n 工作流导出
│
├── docker-compose.yml
├── 谁是卧底.md                       # PRD 文档
├── README_Wallpaper.md              # 架构参考
└── docs/
    └── plans/
        ├── 2026-01-16-project-mimic-architecture.md      # 原始架构
        └── 2026-01-16-project-mimic-architecture-mvp.md  # MVP 架构 (本文档)
```

---

## 实施阶段 (MVP)

### Phase 1: 核心循环 (2 周)

**目标**: 跑通绘画→展示→投票基础流程

#### 1.1 后端基础

- [ ] 初始化 Rust 项目 (Axum + SQLx)
- [ ] PostgreSQL 数据库 + 迁移脚本
- [ ] Redis 连接 (房间状态缓存)
- [ ] Docker Compose 开发环境

#### 1.2 API 实现

- [ ] 主题 API (GET /api/themes)
- [ ] 房间 API (POST/GET /api/rooms)
- [ ] 绘画上传 API (POST /api/rooms/{code}/drawings) - Base64
- [ ] WebSocket 基础连接

#### 1.3 游戏逻辑

- [ ] 投票 API + 淘汰逻辑
- [ ] 计数器触发器 (total % 5 == 0)
- [ ] 动态投票阈值 (在线人数 30%)

#### 验收标准

- [ ] 用户可以绘画并提交 (Base64)
- [ ] 作品在场景中显示
- [ ] 可以投票并看到淘汰效果
- [ ] 手动插入测试数据验证流程

---

### Phase 2: AI 集成 (1 周)

**目标**: 接入 Zenmux nano-banana Pro

#### 2.1 n8n 工作流

- [ ] 部署 n8n
- [ ] 创建 mimic-ai-workflow
- [ ] 配置 Zenmux API credentials
- [ ] 测试生图 + LLM 元数据

#### 2.2 回调集成

- [ ] n8n callback API
- [ ] AI 作品自动入库
- [ ] WebSocket 广播 ai_spawned

#### 验收标准

- [ ] 每 5 个用户作品自动生成 1 个 AI
- [ ] AI 图片风格接近用户涂鸦
- [ ] AI 名称/介绍自然

---

### Phase 3: 优化 (1 周)

**目标**: 提升体验 + 稳定性

#### 3.1 性能优化

- [ ] WebSocket 消息批处理 (position_batch_update)
- [ ] 前端图片懒加载
- [ ] 数据库查询优化 (避免大 Base64 字段)

#### 3.2 游戏体验

- [ ] 浑浊度视觉效果
- [ ] 淘汰动画
- [ ] Game Over 爆炸效果

#### 验收标准

- [ ] 30+ 物体流畅渲染
- [ ] 投票体验流畅
- [ ] 视觉反馈完整

---

## 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| AI 画风太完美 | 太容易识别 | 调整 prompt 增加 "messy" 元素 |
| Base64 数据库压力 | 性能下降 | 图片压缩 + 分页加载 + 未来迁移 OSS |
| Zenmux API 不稳定 | AI 生成失败 | 重试机制 + 预设图库兜底 |
| WebSocket 高并发 | 卡顿 | Redis Pub/Sub + 消息批处理 |

---

## 未来扩展路径

### 图片存储迁移 (OSS)

当用户量增长时，可迁移到 OSS：

```typescript
// 抽象接口设计
interface ImageStorage {
  save(imageData: string): Promise<string>;
  get(id: string): Promise<string>;
}

// MVP: PostgreSQL Base64
class PostgresStorage implements ImageStorage { ... }

// 未来: OSS
class OSSStorage implements ImageStorage { ... }
```

### 其他扩展

- 内容审核 API
- 多主题支持
- 排行榜/成就系统

---

## 参考资料

- PRD: `谁是卧底.md`
- 架构参考: `README_Wallpaper.md`
- 前端代码: `frontend/`
- Zenmux API: https://zenmux.ai
- n8n 文档: https://docs.n8n.io/
