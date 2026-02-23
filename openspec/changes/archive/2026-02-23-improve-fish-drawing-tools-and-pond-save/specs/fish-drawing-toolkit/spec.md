## ADDED Requirements

### Requirement: 画板工具栏提供核心绘制能力
系统 SHALL 提供画板工具栏能力，包括画笔模式、橡皮模式、笔触大小调节、撤销与保存，以支持用户在单一流程中完成鱼的绘制。

#### Scenario: 用户在画笔与橡皮之间切换
- **WHEN** 用户点击画笔或橡皮控制项
- **THEN** 系统 SHALL 立即切换当前绘制模式，且下一笔 SHALL 使用新模式

#### Scenario: 用户调整笔触大小
- **WHEN** 用户在工具栏中修改笔触大小
- **THEN** 后续绘制笔触 SHALL 持续使用该大小，直到用户再次修改

### Requirement: 画笔颜色仅允许 frontend 规定色板
系统 SHALL 将可选画笔颜色限制为 frontend 色板中的 `#000000`、`#FF2A2A`、`#1F75FE`、`#00CC44`、`#FF9900`。

#### Scenario: 用户选择合法色板颜色
- **WHEN** 用户选择了任一允许的色板颜色
- **THEN** 后续绘制笔触 SHALL 使用该精确颜色值进行渲染

#### Scenario: 系统收到不在色板内的颜色输入
- **WHEN** 绘制颜色选择接口收到非允许颜色值
- **THEN** 系统 SHALL 拒绝或归一化该输入，且 SHALL NOT 扩展允许色板集合

### Requirement: 工具栏图标使用产品指定资源
系统 SHALL 使用指定的远程图标资源用于画笔、橡皮与保存控制项。

#### Scenario: 绘制 UI 渲染操作图标
- **WHEN** 绘制界面展示时
- **THEN** 画笔控制项 SHALL 使用 `https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com/draw.png?imageSlim`，橡皮控制项 SHALL 使用 `https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com/eraser.png?imageSlim`，保存控制项 SHALL 使用 `https://turing-test-1319469298.cos.ap-guangzhou.myqcloud.com/save.png?imageSlim`
并且 在底部横向排列， 间隔20px， 每个图标大小为40px

### Requirement: 撤销可回退最近一次绘制操作
系统 SHALL 允许用户在不清空整张画布的前提下撤销最近一次绘制操作。

#### Scenario: 用户在绘制后执行撤销
- **WHEN** 用户触发撤销且历史中至少存在一次可撤销操作
- **THEN** 画布 SHALL 精确回退一个操作步骤，并保留更早的绘制结果
