# Remote 资源管理与新增素材流程（项目标准）

> 适用项目：`cocos-game/The-Reverse-Turing-Test`  
> 目标：后续新增素材都按同一套方式做，保证编辑器可预览、微信包体可控、运行时可远程替换。

## 1) 当前项目的动态资源机制（现状）

### 1.1 资源定义层
- 统一在 `assets/scripts/core/ResourceConfig.ts` 维护：
  - `REMOTE_RESOURCES`：资源 key、Bundle 路径、COS 远程 URL、是否 preload
  - `NODE_MAPPING`：`key -> 场景节点名`
- `assets/RemoteUI.meta` 已配置为 `isBundle: true` + `isRemote: true`（Bundle 名 `RemoteUI`）。

### 1.2 加载层
- `assets/scripts/core/ResourceLoader.ts`
  - 浏览器/编辑器：优先 `assetManager.loadBundle('RemoteUI')`，失败 fallback 到 `loadRemote`
  - 微信小游戏：直接 `loadRemote`（跳过 Bundle native）
  - 有缓存、并发去重、超时保护。

### 1.3 应用层
- `assets/scripts/core/GameBootstrap.ts`
  - 启动时 `preloadResources()`
  - 完成后 `applyRemoteImages()`，按 `NODE_MAPPING` 找节点并替换 `Sprite.spriteFrame`。

### 1.4 构建层
- 主流程使用扩展：`extensions/remote-bundle-cleaner/dist/hooks.js`
  - 构建前：动态扫描 `assets/RemoteUI/*.png.meta`，临时移除场景静态引用
  - 构建后：恢复场景、清理 `RemoteUI/native/`，并在 `main/native/` 放占位图，避免运行时缺文件
- `scripts/build-helper.cjs` / `scripts/post-build-clean.cjs` 视为兼容脚本（非首选）。

---

## 2) 新增素材的标准流程（以后都按这个）

### Step A. 放入项目并可预览
1. 把图片放到 `assets/RemoteUI/`。
2. 在 Cocos 编辑器里把该图临时拖到目标 `Sprite`（确保美术可见、节点名确认正确）。

### Step B. 上传远程源
1. 上传同名资源到 COS（或你的远程资源源）。
2. 拿到最终 URL（建议固定路径，不要频繁改文件名）。

### Step C. 更新资源配置（必做）
1. 在 `ResourceConfig.REMOTE_RESOURCES` 新增条目：
   - `key`（唯一）
   - `bundlePath`（例如 `foo/spriteFrame`）
   - `remoteUrl`（COS URL）
   - `preload`（主界面资源通常 `true`）
2. 在 `ResourceConfig.NODE_MAPPING` 增加 `key -> 节点名`。

示例：
```ts
{
  key: 'new_banner',
  bundlePath: 'new_banner/spriteFrame',
  remoteUrl: 'https://your-cos-domain/new_banner.png',
  type: 'image',
  preload: true,
}
```

### Step D. 节点规范（必做）
- `NODE_MAPPING` 里的节点名必须和场景里完全一致。
- 节点必须有 `Sprite` 组件（否则 `applyRemoteImages()` 无法替换）。

### Step E. 构建与发布
1. 正常用 Cocos 构建（扩展会自动处理 RemoteUI 引用清理/恢复）。
2. 微信真机要配置合法域名：
   - `downloadFile`：COS 域名
   - `request`：API 域名
   - `socket`：WSS 域名（若用到）

---

## 3) 两类资源要区分

### 类型 1：启动即替换（主菜单/固定 UI）
- 走 `ResourceConfig + GameBootstrap.applyRemoteImages()`。
- 适合主页按钮、背景、图标这类固定节点资源。

### 类型 2：运行时临时加载（动态鱼图/外部链接）
- 直接调用 `ResourceLoader.loadRemoteImage(url, key?)`。
- 适合玩家内容、活动图、临时素材。

---

## 4) 以后给这个项目加素材，我会遵守的默认规则

1. 先加到 `assets/RemoteUI/`，保持编辑器可预览。  
2. 必改 `ResourceConfig.REMOTE_RESOURCES` 与 `NODE_MAPPING`。  
3. 不把 URL 散落写在业务脚本里（统一收敛到 `ResourceConfig`）。  
4. 以 `remote-bundle-cleaner` 扩展为主，不手动维护 UUID 列表。  
5. 提交时附上“新增 key、节点名、远程 URL”变更说明。

---

## 5) 故障排查速查

- **资源没替换**：优先查 `NODE_MAPPING` 节点名是否一致、目标节点是否有 `Sprite`。
- **编辑器有图，真机没图**：优先查微信合法域名（download/request/socket）。
- **包体异常变大**：确认构建扩展生效，检查 `RemoteUI/native/` 是否被清理。
- **同一资源重复请求**：确认调用方是否使用统一 `key`，利用 `ResourceLoader` 缓存。
