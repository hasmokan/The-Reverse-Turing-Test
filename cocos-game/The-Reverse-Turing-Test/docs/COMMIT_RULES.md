# Git 提交规则（强制）

> 适用项目：`cocos-game/The-Reverse-Turing-Test`

## 1) 提交信息格式（必须）

统一使用：`<type>(<scope>): <中文摘要>`

- `type` 允许：`feat`、`fix`、`chore`、`docs`、`refactor`、`perf`、`test`、`build`、`ci`。
- `scope` 可选，建议写受影响模块（如 `ui`、`resource`、`mcp`）。
- 冒号后必须是中文摘要，首句清楚说明“做了什么”。

示例：
- `feat(ui): 新增主界面鱼缸入口按钮`
- `fix(multiplayer): 修复返回主菜单报错`
- `chore(mcp): 补充 Codex 连接 Cocos MCP 启动说明`

## 2) 提交前检查清单（必须逐条执行）

1. 只提交本次任务相关文件，避免混入无关改动。
2. 运行 `git status --short`，确认改动范围。
3. 运行 `git diff --staged`，逐行确认要提交的内容。
4. 若包含文档和代码，优先拆分为多个小提交。
5. 提交后保留提交哈希，并在说明中列出核心文件。

## 3) 禁止项

- 禁止使用无前缀提交信息（如 `update`、`修改一下`）。
- 禁止英文占位摘要（如 `wip`、`tmp`、`fix bug`）。
- 禁止一次提交混入多个无关主题。
