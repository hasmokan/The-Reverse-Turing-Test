# Project Mimic - 谁是AI卧底

基于 UGC 与 AIGC 对抗的多人在线休闲游戏。

## 技术栈

- **框架**: Next.js 15 (React 19)
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **动画**: Framer Motion
- **实时通信**: Socket.IO (待接入)

## 游戏特色

- 🎨 **儿童画风格** - shaky lines, wobbly strokes, thick outlines
- 🤖 **AI 卧底** - AI 生成的画作混入玩家作品
- 🗳️ **投票博弈** - 找出并投票淘汰 AI 画作
- 💥 **危机机制** - AI 数量超标则游戏结束

## 开始开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
frontend/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/
│   │   ├── canvas/       # 绘画模块
│   │   ├── stage/        # 公共场景模块
│   │   ├── ui/           # 通用 UI 组件
│   │   └── voting/       # 投票相关组件
│   ├── config/           # 主题配置
│   ├── hooks/            # 自定义 Hooks
│   ├── lib/              # 工具函数和状态管理
│   └── types/            # TypeScript 类型定义
└── public/               # 静态资源
```

## AI Prompt 指南

### 图像生成风格
```
Style: children's drawing, scribble, thick marker lines, wobbly lines, MS paint style, no shading, flat color

Negative: realistic, 3d, photorealism, perfect, gradient, complex details, perfect symmetry
```

### 文本生成 Prompt
```
你是一个不会画画的普通人，刚刚在手机上随便画了一条丑鱼。
请用简短、口语化、甚至有点敷衍的语气给它起个名字（5字内）和介绍（15字内）。
```
