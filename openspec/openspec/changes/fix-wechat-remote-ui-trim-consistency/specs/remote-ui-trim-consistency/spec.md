## ADDED Requirements

### Requirement: 远程 UI 映射必须保持 SpriteFrame 几何一致性
系统在将远程图片应用到已存在 Sprite 节点时 SHALL 复用该节点原始 `SpriteFrame` 的几何参数（至少包含 rect、offset、originalSize 与旋转语义），以保证真机视觉与编辑器导入资源的一致性。

#### Scenario: 目标节点存在模板 SpriteFrame 且纹理尺寸兼容
- **WHEN** 资源映射流程将远程图片应用到一个已有 `SpriteFrame` 的目标 Sprite，且远程纹理尺寸覆盖模板 rect
- **THEN** 系统 SHALL 使用远程纹理与模板几何参数构建最终 `SpriteFrame`
- **AND** 该节点的视觉边界 SHALL 与编辑器内同节点表现一致

### Requirement: 几何不兼容时必须安全回退
当模板几何参数与远程纹理尺寸不兼容时，系统 MUST 回退到安全渲染路径，且 MUST NOT 因此触发崩溃或阻断映射流程。

#### Scenario: 模板 rect 超出远程纹理范围
- **WHEN** 系统检测到模板 rect 超出远程纹理宽高边界
- **THEN** 系统 MUST 回退为纯远程纹理 `SpriteFrame` 渲染
- **AND** 系统 SHALL 记录可诊断日志（至少包含资源 key 或目标节点信息）

### Requirement: 行为必须受自动化契约测试保护
系统 MUST 提供自动化测试约束远程 UI 映射中的“模板复用 + 安全回退”行为，以防后续重构导致视觉一致性回归。

#### Scenario: 运行 scene-contract 测试集
- **WHEN** 执行 `test:scene-contract`
- **THEN** 测试 SHALL 验证资源映射实现包含模板几何复用路径
- **AND** 测试 SHALL 验证实现包含不兼容情况下的回退路径
