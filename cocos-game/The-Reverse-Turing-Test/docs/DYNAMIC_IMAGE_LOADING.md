# 动态图片加载逻辑

本文档描述项目中动态图片加载的完整架构，涵盖 Cocos Creator 游戏端、Rust 后端和 React 前端三个层面。

---

## 📋 目录

1. [整体数据流](#1-整体数据流)
2. [Cocos Creator 游戏端](#2-cocos-creator-游戏端)
3. [Rust 后端 — 图片存储](#3-rust-后端--图片存储)
4. [React 前端](#4-react-前端)
5. [关键技术点](#5-关键技术点)

---

## 1. 整体数据流

```
用户绘制 → Canvas 导出 Base64 PNG → 前端提交 API → 后端解码上传 S3/存DB
    → 返回图片URL → WebSocket 广播 → 各客户端动态加载显示
```

**Cocos 端**通过 `assetManager.loadRemote<ImageAsset>` 统一处理远程图片，配合内存缓存 `Map<string, SpriteFrame>` 避免重复加载。

---

## 2. Cocos Creator 游戏端

### 2.1 核心资源加载器 — ResourceLoader

**文件**: `assets/scripts/core/ResourceLoader.ts`

| 方法 | 行号 | 说明 |
|------|------|------|
| `loadRemoteImage(url, key?)` | 120-145 | 远程图片加载入口，内置缓存和防重复加载 |
| `_loadImageInternal(url, cacheKey)` | 150-183 | 底层实现，调用 `assetManager.loadRemote<ImageAsset>` |
| `preloadResources()` | 52-112 | 批量预加载，支持并发和进度回调 |
| `getSpriteFrame(key)` | 188+ | 获取已加载的 SpriteFrame |
| `isLoaded(key)` | 188+ | 检查资源是否已加载 |
| `clearCache()` / `clearCacheByKey(key)` | 188+ | 清除缓存 |

**加载流程**:

```
loadRemoteImage(url)
  ├── 检查缓存 → 命中则直接返回 SpriteFrame
  ├── 检查是否正在加载 → 是则复用 Promise
  └── _loadImageInternal(url, cacheKey)
        ├── 推断图片扩展名
        ├── assetManager.loadRemote<ImageAsset>(url)
        ├── new Texture2D() → texture.image = imageAsset
        └── new SpriteFrame() → spriteFrame.texture = texture → 存入缓存
```

### 2.2 资源配置 — ResourceConfig

**文件**: `assets/scripts/core/ResourceConfig.ts`

- **COS 基础路径** (第16行):
  ```typescript
  private static readonly COS_BASE_URL = 'https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com'
  ```

- **REMOTE_RESOURCES** (第39-118行): 所有远程资源配置数组，每项包含:
  - `key` — 资源唯一标识
  - `url` — 远程地址
  - `type` — 资源类型
  - `preload` — 是否预加载
  - `bundle` — 所属 bundle

- **NODE_MAPPING** (第26-37行): 资源 key → 场景节点名称的映射

- **查询方法**:
  - `getPreloadResources(bundleName?)` — 获取需要预加载的资源列表
  - `getResource(key)` / `getResourceUrl(key)` — 根据 key 查询资源

### 2.3 游戏启动器 — GameBootstrap

**文件**: `assets/scripts/core/GameBootstrap.ts`

| 方法 | 行号 | 说明 |
|------|------|------|
| `preloadResources()` | 50-85 | 调用 ResourceLoader 预加载所有资源，更新进度 |
| `applyRemoteImages()` | 90-127 | 遍历 NODE_MAPPING，将 SpriteFrame 应用到场景 Sprite 组件 |

### 2.4 背景管理器 — BackgroundManager

**文件**: `assets/scripts/ui/BackgroundManager.ts`

- `remoteUrl` 属性 (第25-26行) — 支持远程背景图 URL 配置（优先于本地资源）
- `loadRemoteBackground(url)` (第67-89行) — 使用 `assetManager.loadRemote` 加载远程背景
- `fitToScreen()` (第112-147行) — 支持 COVER / CONTAIN / STRETCH 三种适配模式
- `changeBackground(spriteFrame)` (第213-221行) — 动态更换背景图

### 2.5 鱼相关的动态加载

#### FishController — `assets/scripts/game/FishController.ts`

| 方法 | 行号 | 说明 |
|------|------|------|
| `loadFishImage(imageUrl)` | 81-90 | 入口，自动判断 Base64 或远程 URL |
| `loadBase64Image(base64)` | 95-109 | 通过 HTML Image 对象加载 Base64 图片 |
| `loadRemoteImage(url)` | 114-131 | 通过 `assetManager.loadRemote` 加载远程图片 |

#### DrawingBoard — `assets/scripts/ui/DrawingBoard.ts`

- `captureSpriteFrame()` (第179-222行) — 捕获画布内容为 SpriteFrame
  - 创建 RenderTexture → 相机渲染到纹理 → 返回 SpriteFrame

#### FishSpawner — `assets/scripts/game/FishSpawner.ts`

- `spawnCustomFish(spriteFrame)` (第49-96行) — 实例化鱼预制体并设置自定义纹理

#### CustomFish — `assets/scripts/game/CustomFish.ts`

- `setTexture(spriteFrame)` (第36-41行) — 设置鱼的外观纹理

#### FishDetailPanel — `assets/scripts/ui/FishDetailPanel.ts`

- 第325-340行 — 加载 Base64 图片显示在详情面板

---

## 3. Rust 后端 — 图片存储

### 3.1 图片存储服务

**文件**: `backend/src/services/image_store.rs`

**`ImageStore` trait** (第15-27行):

```rust
trait ImageStore {
    fn prepare_drawing_image_data() // 准备图片数据（上传S3或存DB）
    fn get_drawing_image()          // 获取图片数据
}
```

**两种存储后端**:

| 实现 | 行号 | 存储方式 |
|------|------|----------|
| `DbDataUrlImageStore` | 146-174 | 直接存 Base64 data URL 到数据库 |
| `OpendalS3ImageStore` | 177-225 | 上传到 S3/COS，DB 存标记 `"od:s3\|{mime}\|{key}"` |

**辅助函数**:
- `decode_image_data()` (第35-70行) — 解析 data URL，支持 PNG/JPEG/WebP
- `build_image_store()` (第72-122行) — 根据配置构建存储实例
- `parse_od_s3_marker()` (第124-134行) — 解析 S3 标记字符串
- `ext_from_content_type()` (第136-143行) — MIME → 文件扩展名

### 3.2 绘画路由

**文件**: `backend/src/routes/drawings.rs`

| 路由 | 行号 | 说明 |
|------|------|------|
| `POST /api/rooms/:code/drawings` | 20-166 | 创建绘画，调用 image_store 存储图片 |
| `GET /api/drawings/:id/image` | 186-205 | 获取图片，设置 Content-Type 和缓存头 |

### 3.3 配置

**文件**: `backend/src/config.rs` (第13-19行)

```rust
image_storage_backend: String,  // "db" 或 "s3"
s3_root: String,
s3_bucket: Option<String>,
s3_region: Option<String>,
s3_endpoint: Option<String>,
s3_access_key_id: Option<String>,
s3_secret_access_key: Option<String>,
```

---

## 4. React 前端

### 4.1 画布导出

**文件**: `frontend/src/components/canvas/DrawingCanvas.tsx`

- `exportImage()` (第329-381行) — 导出画布为 PNG data URL
  - 获取绘制内容边界 → 创建临时画布 → 缩放 → 合并填充层和勾边层 → 返回 data URL
- `getContentBounds()` (第278-326行) — 扫描像素计算绘制内容边界框

### 4.2 图片显示

**文件**: `frontend/src/components/stage/GameStage.tsx`

- 第229行 — `<img src={item.imageUrl}>` 显示游戏物品图片
- 第114-119行 — CSS `backgroundImage` 动态加载主题背景

### 4.3 图片审核

**文件**: `frontend/src/hooks/useImageReview.ts`

- `reviewImage()` (第34-89行) — 提交前调用 MiniMax API 进行内容审核

### 4.4 API 与 WebSocket

**文件**: `frontend/src/lib/api.ts`

- `createDrawing()` (第173-181行) — POST 提交绘画（含 Base64 图片数据）
- `getDrawing()` (第186-188行) — GET 获取绘画详情

**文件**: `frontend/src/hooks/useWebSocket.ts`

- `convertBackendItem()` (第91-120行) — 转换后端数据，处理图片 URL

---

## 5. 关键技术点

### 支持的图片格式
- PNG、JPEG、WebP
- Base64 data URL

### 图片加载方式
| 端 | 方式 |
|----|------|
| Cocos Creator | `assetManager.loadRemote<ImageAsset>()` |
| React 前端 | `<img src={url}>` / CSS `background-image` |

### 缓存机制
- **Cocos ResourceLoader**: 内存缓存 `Map<string, SpriteFrame>`，防重复加载使用 Promise 缓存
- **后端图片响应**: 设置 HTTP 缓存头

### 存储方案
| 方案 | 适用场景 | 存储内容 |
|------|----------|----------|
| 数据库 (db) | 开发/小规模 | 完整 Base64 data URL |
| S3/COS (s3) | 生产环境 | 标记字符串 `"od:s3\|{mime}\|{key}"` |
