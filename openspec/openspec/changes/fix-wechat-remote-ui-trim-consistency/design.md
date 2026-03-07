## Context

当前项目在微信小游戏环境采用远程资源加载：`ResourceLoader` 通过 `assetManager.loadRemote` 拉取图片并动态创建 `SpriteFrame`。该路径与编辑器/本地 bundle 导入路径不同，导致远程 `SpriteFrame` 不包含本地导入阶段生成的 trim、offset、originalSize 等几何信息。结果是同一 UI 节点在编辑器与真机显示不一致，典型表现为按钮视觉“变扁”或留白异常。

约束如下：
- 不能破坏现有远程资源映射流程（`ResourceConfig.NODE_MAPPING` + `applyMappedSpriteFrames`）。
- 需要兼容微信小游戏和非微信环境，且避免引入额外网络依赖。
- 必须保留现有失败回退能力，不能因为几何参数不匹配导致运行时崩溃。

## Goals / Non-Goals

**Goals:**
- 在远程 UI 图片应用阶段复用目标节点原始 `SpriteFrame` 的几何参数，保证真机视觉与编辑器一致。
- 当远程纹理尺寸与模板几何不兼容时，安全回退为纯纹理 `SpriteFrame`，避免渲染错误。
- 通过契约测试固化行为，防止后续回归。

**Non-Goals:**
- 不重构 `ResourceConfig` 资源定义结构。
- 不调整 RemoteUI 资源生产流程（不要求重新出图或改 meta）。
- 不修改业务 UI 布局参数（例如按钮节点 `UITransform` 尺寸）。

## Decisions

### Decision 1: 在 `applyMappedSpriteFrames` 阶段做“模板复用”
- 方案：读取目标节点当前 `sprite.spriteFrame` 作为模板，使用远程纹理生成新 `SpriteFrame`，并尽量复制模板的 rect/offset/originalSize/rotation/inset。
- 原因：目标节点在场景中已绑定正确导入资源，天然携带与该 UI 期望一致的几何语义；在映射阶段可直接拿到节点上下文。
- 备选方案：
  - 在远程加载阶段直接构造完整几何：缺少节点上下文，无法可靠匹配每个 key 的模板几何。
  - 只改图片资产（移除透明边）：依赖美术重出与资源同步，无法快速且系统性解决。

### Decision 2: 增加纹理尺寸兼容校验并回退
- 方案：在复用模板前检查模板 rect 是否落在远程纹理范围内；若不兼容则记录告警并回退到纯纹理 `SpriteFrame`。
- 原因：避免出现越界/渲染异常，保证线上稳定性优先。
- 备选方案：强制使用模板参数并抛错；该方案会把资源差异升级为运行时故障，风险不可接受。

### Decision 3: 用 scene-contract 测试约束关键行为
- 方案：更新 `remote-ui-loader.contract.test.mjs`，新增“存在模板几何复用与回退路径”的源码契约断言。
- 原因：该仓库已采用 contract test 保护架构行为，增量成本低且可持续防回归。
- 备选方案：仅手工验证真机截图，对后续改动无自动化保护。

## Risks / Trade-offs

- [风险] 远程图片尺寸与本地模板长期漂移，导致频繁回退，视觉仍可能不一致  
  → Mitigation：输出明确日志（含 key 和节点名），并在资源发布流程加入尺寸一致性检查。

- [风险] 每次映射创建新 `SpriteFrame` 可能增加少量内存占用  
  → Mitigation：仅对映射命中的少量 UI 节点执行；后续可按 key 缓存“模板化帧”。

- [取舍] 以稳定回退替代严格失败  
  → Mitigation：优先保证可运行，再通过日志推动资源规范化。

## Migration Plan

1. 在 `ResourceLoader` 增加模板复用 helper，并在 `applyMappedSpriteFrames` 接入。
2. 更新 contract tests，先红后绿验证行为落地。
3. 本地运行 `npm run test:scene-contract`。
4. 微信开发者工具真机预览验证关键节点（含 `DrawMoreButton`）。
5. 如出现异常，回滚至“直接赋值远程 `SpriteFrame`”路径（单文件可逆）。

## Open Questions

- 是否需要为 `draw_more_button` 等关键资源增加“远程图尺寸校验”构建期检查，以减少运行时回退？
- 是否将“模板化 `SpriteFrame`”结果做缓存，进一步降低多场景反复应用时的对象创建成本？
