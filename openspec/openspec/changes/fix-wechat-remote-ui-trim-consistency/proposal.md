## Why

当前微信小游戏真机环境中，远程 UI 图片通过 `loadRemote` 动态创建 `SpriteFrame` 时丢失了本地导入资源的 trim/offset/originalSize 信息，导致按钮等控件在实机显示与编辑器不一致（出现“变扁/留白”）。该问题已影响核心交互可用性，需要立即修复以恢复跨端一致性。

## What Changes

- 新增远程 UI 渲染一致性能力：在应用远程图片到目标节点时，优先复用目标节点原始 `SpriteFrame` 的几何参数（trim、offset、originalSize、旋转信息）。
- 增加安全回退策略：当远程纹理尺寸与模板几何不兼容时，自动回退为当前远程纹理直贴，避免运行时报错。
- 补充契约测试，覆盖“映射应用阶段复用 trim 信息”的行为约束。

## Capabilities

### New Capabilities
- `remote-ui-trim-consistency`: 保证微信真机远程 UI 图片应用后与编辑器内本地导入 `SpriteFrame` 的视觉表现一致。

### Modified Capabilities
- 无

## Impact

- 受影响代码：`assets/scripts/core/ResourceLoader.ts` 的远程图片映射应用路径。
- 测试影响：`tests/scene-contract/remote-ui-loader.contract.test.mjs` 需要新增/更新断言。
- 运行时影响：微信小游戏远程 UI 节点（如 `DrawMoreButton`）显示将与编辑器对齐。
- 兼容性影响：非微信环境行为保持不变；微信环境增加尺寸校验与回退路径。
