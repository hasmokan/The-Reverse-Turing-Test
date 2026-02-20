# AI 项目速读手册（Cocos）

> 更新时间：2026-02-19  
> 适用目录：`cocos-game/The-Reverse-Turing-Test`

这份文档是给“接手这个项目的 AI”看的：先快速理解项目，再尽量用 `cocos-mcp` 完成编辑器操作，减少盲改场景/资源文件导致的问题。

---

## 1. 项目一句话

这是一个基于 **Cocos Creator 3.8.8** 的“反向图灵测试”鱼缸游戏：玩家画鱼、AI 也会生成鱼，玩家通过投票/追击找出 AI 鱼。

当前代码里，核心可玩的流程集中在：
- `MainScene`：启动、预加载、主菜单
- `MultiPlayerScene`：当前主游戏场景（含单人本地编排器）

---

## 2. 强制工作原则（重要）

### 2.1 Cocos-MCP 优先

只要能通过 `cocos-mcp` 完成，就**优先用 MCP**，不要先手改 `.scene` / `.prefab`。

优先级建议：
1. `scene_*` / `node_*`：查结构、查节点、改层级/Transform
2. `component_*` / `set_component_property`：查组件、改属性、挂脚本
3. `prefab_*`：实例化、应用、还原
4. 只有 MCP 做不到时，再改脚本代码

### 2.2 变更最小化

每次只改一类问题（例如只改按钮位置、只改一个组件属性），改完就做最小验证，避免“大改后一起炸”。

### 2.3 记录 MCP 操作痕迹

在提交说明里写清楚：
- 改了哪些节点（名称/uuid）
- 用了哪些 MCP 操作（如 `node_transform`、`set_component_property`）
- 为什么这么改

---

## 3. 代码地图（先看这些）

### 3.1 核心脚本目录

- `assets/scripts/core/`
  - `GameManager.ts`：全局状态与事件中心（单例、持久节点）
  - `GameBootstrap.ts`：启动预加载，远程资源应用到场景
  - `ResourceLoader.ts` / `ResourceConfig.ts`：RemoteUI 资源加载策略
  - `SceneTransition.ts`：场景切换动画

- `assets/scripts/game/`
  - `SinglePlayerController.ts`：当前主编排器（本地模式）
  - `BattleSystem.ts`：投票/追击/换目标/CD
  - `AISpawner.ts`：AI 鱼自动生成
  - `GameStage.ts` / `FishController.ts`：舞台鱼节点、动效、投票反馈

- `assets/scripts/ui/`
  - `main-menu/MenuButtonHandler.ts`：主菜单按钮行为
  - `multiplayer/`：HUD、结果面板、击杀播报、返回按钮等

- `assets/scripts/network/`
  - `APIService.ts`：REST 接口
  - `SocketClient.ts`：Socket.io 连接与事件
  - `DataConverter.ts`：后端数据 → 游戏内数据

- `assets/scripts/data/`
  - `GameTypes.ts`：类型与事件数据
  - `GameConstants.ts`：阈值、环境地址、绘画/网络配置

### 3.2 扩展与构建相关

- `extensions/cocos-mcp-server/`：MCP 编辑器插件
- `extensions/remote-bundle-cleaner/`：构建前后自动处理 RemoteUI 引用/占位图
- `scripts/build-helper.cjs`：备用构建清理脚本（手动 pre/post）

---

## 4. 当前关键流程（务必先理解）

### 4.1 启动与主菜单

1. `MainScene` 启动 `GameBootstrap`
2. `GameBootstrap` 调 `ResourceLoader.preloadResources()`
3. 预加载完成后 `applyRemoteImages()`，按 `ResourceConfig.NODE_MAPPING` 把远程图替换到场景节点
4. 显示主菜单

### 4.2 场景跳转现状

`MenuButtonHandler.ts` 当前“单人游戏”和“深海鱼缸（多人）”按钮都指向 `MultiPlayerScene`。

### 4.3 MultiPlayerScene 的主玩法编排

`SinglePlayerController.ts` 负责主要流程：
- 初始化 `GameManager`
- 启用 `BattleSystem` 本地模式（不依赖 Socket）
- 监听 `DrawingBoard` 提交
- 调 `AISpawner` 生成 AI 鱼
- 驱动阶段流转（绘画/观察/投票/结算）

### 4.4 联网能力（保留链路）

`APIService.ts` + `SocketClient.ts` + `Main.ts` 保留了 REST/WS 联网能力。当前你改玩法时，先确认是“本地单人逻辑”还是“联网房间逻辑”，不要混改。

---

## 5. 高频改动入口（按需求找文件）

- 改游戏阈值/CD/胜负条件：`assets/scripts/data/GameConstants.ts`
- 改阶段状态与全局事件：`assets/scripts/core/GameManager.ts`
- 改主菜单按钮去向：`assets/scripts/ui/main-menu/MenuButtonHandler.ts`
- 改投票/追击/换目标：`assets/scripts/game/BattleSystem.ts`
- 改单人主流程：`assets/scripts/game/SinglePlayerController.ts`
- 改远程 UI 图映射：`assets/scripts/core/ResourceConfig.ts`
- 改资源加载策略：`assets/scripts/core/ResourceLoader.ts`
- 改返回主菜单行为：`assets/scripts/ui/multiplayer/BackToMenuHandler.ts`

---

## 6. RemoteUI 与包体积约束（微信重点）

项目依赖 RemoteUI + 远程 COS 加载来控制包体：
- 浏览器/开发环境：优先 Bundle，失败再 fallback 远程 URL
- 微信小游戏：直接远程 URL（跳过 Bundle native）

新增素材与动态远程加载的标准操作，请严格按：
- `docs/REMOTE_ASSET_LOADING_PLAYBOOK.md`

构建时优先使用：
- `extensions/remote-bundle-cleaner/`（自动处理）

若自动流程不可用，可手动：
1. `node scripts/build-helper.cjs pre`
2. Cocos Creator 构建
3. `node scripts/build-helper.cjs post`

---

## 7. 常见坑（AI 容易踩）

1. **直接手改 `.scene` JSON**：极易破坏引用，先用 MCP。
2. **忘记区分本地模式/联网模式**：`SinglePlayerController` 与 `SocketClient` 的触发链不同。
3. **改了常量没验证联动**：例如 `ELIMINATION_THRESHOLD` 会影响 UI 反馈与结算节奏。
4. **RemoteUI 映射改了但节点名不一致**：`NODE_MAPPING` 里的节点名必须和场景一致。
5. **持久节点重复实例**：`GameManager`、`SocketClient` 等单例脚本要防重。

---

## 8. 最小验证清单（每次改完都做）

1. 打开 `MainScene`，确认无明显脚本报错。
2. 进入 `MultiPlayerScene`，确认核心 UI（绘画、HUD、结果面板）可见。
3. 画一条鱼并提交，确认能进入鱼缸并可被点击。
4. 触发一次投票/追击，确认 CD 与票数反馈正常。
5. 返回主菜单，确认场景切换与按钮状态正常。

---

## 9. 新会话接手模板（给下一个 AI）

开始工作前先回答这 5 个问题：
1. 这次需求是“编辑器节点改动”还是“脚本逻辑改动”？
2. 哪些部分可以先用 `cocos-mcp` 完成？
3. 影响的是本地单人流程、联网流程，还是两者？
4. 是否触及 RemoteUI/构建链路？
5. 改完后的最小验证步骤是什么？

如果不能明确回答，先不要改代码，先查场景节点和脚本绑定关系。

---

## 10. Git 提交规范（强制）

每次提交前必须遵守：
1. 提交信息格式：`<type>(<scope>): <中文摘要>`。
2. `type` 使用：`feat`、`fix`、`chore`、`docs`、`refactor`、`perf`、`test`、`build`、`ci`。
3. 只提交本次任务相关文件，不混入无关改动。
4. 提交前执行 `git status --short` 与 `git diff --staged` 逐项确认。

完整规则见：`docs/COMMIT_RULES.md`。
