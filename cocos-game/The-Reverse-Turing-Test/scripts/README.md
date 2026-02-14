# 构建脚本文档

## 背景

微信小游戏主包限制 **4MB**，但项目中 `RemoteUI` Asset Bundle 包含约 **2.2MB** 的 PNG 图片资源。
Cocos Creator 编辑器中需要直接预览这些图片（Sprite 静态引用），导致构建时图片被重复打包到 `main/native/` 和 `RemoteUI/native/`，使总包体远超 4MB。

### 解决方案架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        开发阶段（编辑器）                         │
│  MainScene.scene 中 Sprite 直接引用 RemoteUI 图片 → 编辑器可预览  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    build-helper.cjs pre
                     （移除场景引用）
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Cocos Creator 构建                           │
│  场景中引用已置空 → 图片不会被复制到 main/native/                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    build-helper.cjs post
                （恢复场景 + 删除 RemoteUI/native/）
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     构建产物（≤ 4MB）                             │
│  main/native/: 仅 white-pixel.png (69B)                         │
│  RemoteUI/:    仅 config.json + import/ + index.js（无 native/） │
└─────────────────────────────────────────────────────────────────┘
                              │
                         微信小游戏运行时
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     运行时加载策略                                │
│  ResourceLoader 检测微信环境 → 跳过 Bundle 加载                   │
│  → 直接从 COS 远程 URL 下载图片                                  │
│  → GameBootstrap.applyRemoteImages() 动态替换场景中的 Sprite      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 脚本清单

| 脚本 | 用途 | 使用时机 |
|------|------|----------|
| `build-helper.cjs` | 构建前后处理（**推荐使用**） | 每次构建微信小游戏前后 |
| `post-build-clean.cjs` | 仅清理 RemoteUI/native/ | 简单清理场景（已被 build-helper 包含） |

---

## build-helper.cjs

核心构建辅助脚本，包含 `pre`（构建前）和 `post`（构建后）两个阶段。

### 使用方法

```bash
# 从项目根目录运行
cd cocos-game/The-Reverse-Turing-Test

# 构建前：备份场景 + 移除 RemoteUI 图片引用
node scripts/build-helper.cjs pre

# >>> 在 Cocos Creator 中构建微信小游戏 <<<

# 构建后：恢复场景 + 清理构建产物中的 native 资源
node scripts/build-helper.cjs post
```

### pre 阶段（构建前）

**作用**：临时移除 `MainScene.scene` 中对 RemoteUI 图片的静态引用，防止 Cocos Creator 构建时将图片复制到 `main/native/`。

**流程**：
1. 检查是否存在上次未恢复的备份（`.bak`），如有则先恢复
2. 备份 `MainScene.scene` → `MainScene.scene.bak`
3. 用正则匹配场景中 10 个 RemoteUI 图片的 `_spriteFrame` 引用
4. 将匹配到的引用替换为 `"_spriteFrame": null`
5. 写回修改后的场景文件

**涉及的 UUID**（10 个 RemoteUI 资源）：

| UUID（前8位） | 对应资源 | 场景节点 |
|---------------|----------|----------|
| `d1405970` | home_bg | Background |
| `d67307a6` | multiplay | multiplay |
| `d5aa00f5` | rank | rank |
| `83ed7d27` | single_play | single_play |
| `82ecad44` | title_img | anime_lobby_variant_1 (2) |
| `d7f72387` | profile | profile |
| `850caea2` | icon_gear1 | 灰色齿轮图标1 |
| `07ef7d44` | icon_gear2 | 灰色齿轮图标2 |
| `3d3493d4` | icon_brain | 肉色大脑图标 |
| `7dd00fed` | icon_bulb | 黄色灯泡图标 |

### post 阶段（构建后）

**作用**：恢复源场景文件，并清理构建产物中的 RemoteUI 原生资源。

**流程**：
1. 从 `.bak` 备份恢复 `MainScene.scene`，删除备份文件
2. 自动定位最新的 `build/` 子目录
3. 删除 `RemoteUI/native/` 目录（释放 ~2.2MB）
4. 检查 `main/native/` 是否有多余文件（应仅保留 1 个 white-pixel.png）
5. 输出清理统计报告

### 输出示例

```
# pre 输出
📋 已备份场景: MainScene.scene → MainScene.scene.bak
   ✏️  已移除引用: d1405970...
   ✏️  已移除引用: d67307a6...
   ... (共 10 个)
✅ 预处理完成：移除 10 个 RemoteUI 引用

# post 输出
📋 已恢复场景: MainScene.scene.bak → MainScene.scene
🔍 构建目录: .../build/wechatgame-001
📦 RemoteUI/native/: 11 个文件, 2.24 MB
   ✅ 已删除 — 释放 2.24 MB
📌 main/native/: 1 个文件 (0.1 KB)
🎉 完成！总计释放 2.24 MB
```

---

## post-build-clean.cjs

简化版的构建后清理脚本，仅删除 `RemoteUI/native/` 目录。

> **注意**：`build-helper.cjs post` 已包含此功能，推荐使用 `build-helper.cjs`。本脚本保留作为快速清理工具。

### 使用方法

```bash
# 自动定位最新构建目录
node scripts/post-build-clean.cjs

# 指定构建目录
node scripts/post-build-clean.cjs build/wechatgame-001
```

---

## 完整构建流程

### 微信小游戏构建 Checklist

```bash
# 1. 构建前预处理
node scripts/build-helper.cjs pre

# 2. 在 Cocos Creator 中构建
#    项目 → 构建发布 → 微信小游戏 → 构建

# 3. 构建后处理
node scripts/build-helper.cjs post

# 4. 验证构建产物
#    - 总大小应 ≤ 4MB
#    - RemoteUI/native/ 不应存在
#    - main/native/ 应仅有 1 个文件 (white-pixel.png, 69B)

# 5. 在微信开发者工具中测试
#    - 刷新项目
#    - 模拟器中确认图片加载正常
#    - 预览/扫码真机测试
```

### 构建产物预期结构

```
build/wechatgame-001/
├── assets/
│   ├── main/
│   │   ├── config.json
│   │   ├── import/          # 场景、脚本等编译数据
│   │   ├── native/
│   │   │   └── 75/
│   │   │       └── xxx.png  # white-pixel (69B)
│   │   └── index.js         # 编译后的游戏逻辑
│   ├── RemoteUI/
│   │   ├── config.json      # Bundle 元数据
│   │   ├── import/           # SpriteFrame 序列化数据
│   │   └── index.js          # Bundle 预加载脚本
│   │   # ❌ 无 native/ 目录（已被 post 清理）
│   └── internal/
├── cocos-js/                 # Cocos 引擎
├── game.js
├── game.json
└── project.config.json
```

---

## 运行时加载系统

构建产物中没有图片原始文件，运行时通过以下组件协作加载：

### 关键文件

| 文件 | 职责 |
|------|------|
| `assets/scripts/core/ResourceConfig.ts` | 定义 COS 远程 URL、Bundle 路径、节点映射关系 |
| `assets/scripts/core/ResourceLoader.ts` | 资源加载管理器（分环境策略） |
| `assets/scripts/core/GameBootstrap.ts` | 游戏启动器，协调加载流程并替换场景精灵 |

### 加载策略（分环境）

```
浏览器/开发环境:
  loadBundle('RemoteUI')
  → bundle.load('home_bg/spriteFrame')  ← 从本地 Bundle 加载
  → 失败则 fallback 到 COS URL

微信小游戏:
  跳过 Bundle 加载
  → assetManager.loadRemote(cosUrl)      ← 直接从 COS 远程下载
```

### COS 远程资源地址

```
基础路径: https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com
```

---

## 微信域名配置

在 [微信公众平台](https://mp.weixin.qq.com) → **开发管理** → **开发设置** → **服务器域名** 中配置：

| 域名类型 | 域名 |
|----------|------|
| request 合法域名 | `https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com` |
| downloadFile 合法域名 | `https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com` |

> **开发调试**：在微信开发者工具中 **详情** → **本地设置** → 勾选 **"不校验合法域名"** 可临时跳过域名校验。

---

## 故障排除

### 构建产物超过 4MB

- 确认执行了 `build-helper.cjs post`
- 检查 `RemoteUI/native/` 是否已删除
- 检查 `main/native/` 是否有多余 PNG（应仅有 1 个 69B 文件）
- 如果 `main/native/` 仍有大图片：可能新增了 RemoteUI 资源但未更新 `REMOTE_UUIDS` 列表

### 模拟器正常，真机黑屏/无图片

1. **确认新代码已编入构建**：在构建产物的 `assets/main/index.js` 中搜索 `_isWeChatMiniGame`，如果找不到说明未重新构建
2. **确认微信域名配置**：COS 域名必须在 downloadFile 合法域名列表中
3. **关闭"不校验合法域名"测试**：在开发者工具中取消勾选此选项，如果模拟器也无法加载图片，说明域名配置有问题

### 模拟器也无法加载图片

- 检查 COS 资源是否可访问：`curl -I "https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com/multiplay.png"`
- 检查 `ResourceConfig.ts` 中的 COS URL 是否正确
- 检查 `ResourceConfig.NODE_MAPPING` 中的节点名称是否与场景匹配

### pre 脚本未移除所有引用

- 新增 RemoteUI 图片后，需要将新图片的 UUID 添加到 `build-helper.cjs` 的 `REMOTE_UUIDS` 列表
- UUID 来源：对应图片的 `.meta` 文件中的 `uuid` 字段

### 编辑器中图片消失

- 确认 `post` 阶段已恢复场景文件（检查 `.bak` 文件是否已删除）
- 如果 `.bak` 文件仍存在，手动恢复：`cp MainScene.scene.bak MainScene.scene`

---

## 维护指南

### 新增 RemoteUI 图片

当向 `assets/RemoteUI/` 添加新图片时：

1. **获取 UUID**：查看新图片的 `.meta` 文件中的 `uuid` 字段
2. **更新构建脚本**：将 UUID 添加到 `build-helper.cjs` 的 `REMOTE_UUIDS` 数组
3. **更新资源配置**：在 `ResourceConfig.ts` 中添加对应的 `REMOTE_RESOURCES` 条目和 `NODE_MAPPING` 映射
4. **上传 COS**：将图片上传到 COS 对应路径
5. **测试**：完整执行 pre → build → post 流程验证
