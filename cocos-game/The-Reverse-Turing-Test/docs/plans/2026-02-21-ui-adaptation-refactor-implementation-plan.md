# UI 多端适配重构 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基于 Cocos 3.8.8 官方适配机制（Canvas + Widget + SafeArea + Sliced），重构 MainScene/MultiPlayerScene 的适配方案，满足“宽度不裁切、无黑边、高度不足自动拉伸、刘海屏交互安全区统一”。

**Architecture:** 采用“全局策略 + 场景约束 + 节点微调”三层方案：全局由 `Canvas` 统一宽度优先；背景由 `BackgroundManager` 统一执行“宽度贴合 + 高度兜底拉伸”；交互区由 `SafeArea + Widget` 约束；需要分端差异的节点由可配置 `UIAdaptorProfile` 执行偏移/缩放。所有规则先写场景契约测试，再逐步落地。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Scene JSON（`.scene`）、Node.js 内置测试（`node --test`）、微信小游戏真机验证。

---

## 参考依据（官方 + 文章）

1. 官方：多分辨率适配方案（Canvas Fit Width/Fit Height、Widget 配合）  
   https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/engine/multi-resolution.html
2. 官方：Widget 组件参考（边距/拉伸/AlignMode）  
   https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/editor/widget.html
3. 官方：SafeArea 组件参考（异形屏安全区，内部依赖 `sys.getSafeAreaRect`）  
   https://docs.cocos.com/creator/3.8/manual/en/ui-system/components/editor/safearea.html
4. 官方：Sliced Sprite（九宫格）  
   https://docs.cocos.com/creator/3.8/manual/en/ui-system/components/engine/sliced-sprite.html
5. 文章：Cocos——UI多端适配之道（掘金，2021-08-23）  
   https://juejin.cn/post/6999598321610260510

> 与文章的差异：文章推荐根据宽高比动态切换 FitWidth/FitHeight；本项目按业务硬约束固定为“宽不裁切”，因此全局采用宽度优先，并用背景高度补拉伸兜底。

---

### Task 1: 建立“适配契约测试”防回归

**Files:**
- Create: `tests/scene-contract/sceneJson.mjs`
- Create: `tests/scene-contract/adaptation.contract.test.mjs`
- Create: `tests/scene-contract/background.contract.test.mjs`

**Step 1: 写失败测试（Canvas/Widget/SafeArea/BackgroundManager 期望）**

```javascript
// tests/scene-contract/adaptation.contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readScene, findNodeByName, findComponentByType } from './sceneJson.mjs';

test('MainScene Canvas and Background follow adaptation contract', () => {
  const scene = readScene('assets/scenes/MainScene.scene');
  const background = findNodeByName(scene, 'Background');
  assert.ok(background);
  const bgMgr = findComponentByType(scene, background, 'BackgroundManager');
  assert.ok(bgMgr);
  assert.equal(bgMgr.fitMode, 3);
});
```

**Step 2: 运行测试，确认失败**

Run: `node --test tests/scene-contract/adaptation.contract.test.mjs`  
Expected: FAIL（工具函数缺失或断言不通过）

**Step 3: 实现最小测试工具**

```javascript
// tests/scene-contract/sceneJson.mjs
import fs from 'node:fs';
export function readScene(relPath) { /* 读取并 JSON.parse */ }
export function findNodeByName(scene, name) { /* 按 _name 找节点 */ }
export function findComponentByType(scene, node, typeName) { /* 通过 __type__ 查询 */ }
```

**Step 4: 再跑测试，确认转绿**

Run: `node --test tests/scene-contract/*.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add tests/scene-contract
git commit -m "test(adaptation): 新增场景适配契约测试"
```

---

### Task 2: 统一全局适配策略（宽度优先）

**Files:**
- Modify: `settings/v2/packages/project.json`
- Create: `assets/scripts/ui/common/ScreenAdaptationPolicy.ts`
- Modify: `assets/scenes/MainScene.scene`
- Modify: `assets/scenes/MultiPlayerScene.scene`

**Step 1: 写失败测试（配置必须宽度优先）**

```javascript
test('project designResolution is width-first', () => {
  const cfg = JSON.parse(fs.readFileSync('settings/v2/packages/project.json', 'utf8'));
  assert.equal(cfg.general.designResolution.fitWidth, true);
  assert.equal(cfg.general.designResolution.fitHeight, false);
});
```

**Step 2: 运行测试，确认失败**

Run: `node --test tests/scene-contract/adaptation.contract.test.mjs`  
Expected: FAIL

**Step 3: 实现最小改动**

- `project.json` 调整为 `fitWidth=true`、`fitHeight=false`
- 新增 `ScreenAdaptationPolicy.ts`：场景启动时校验并打印当前分辨率策略（只读校验，不强改场景几何）
- MainScene/MultiPlayerScene 的 Canvas 节点挂载该脚本

**Step 4: 复跑测试**

Run: `node --test tests/scene-contract/*.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add settings/v2/packages/project.json assets/scripts/ui/common/ScreenAdaptationPolicy.ts assets/scenes/MainScene.scene assets/scenes/MultiPlayerScene.scene
git commit -m "refactor(adaptation): 统一宽度优先 Canvas 策略"
```

---

### Task 3: 重构 BackgroundManager 为唯一背景适配入口

**Files:**
- Modify: `assets/scripts/ui/common/BackgroundManager.ts`
- Modify: `assets/scripts/core/GameBootstrap.ts`

**Step 1: 写失败测试（背景模式必须 width-priority）**

```javascript
test('BackgroundManager defaults to WIDTH_PRIORITY_STRETCH_HEIGHT', async () => {
  // 合同测试：检查脚本文本或序列化值，确保默认模式=3
});
```

**Step 2: 运行测试，确认失败**

Run: `node --test tests/scene-contract/background.contract.test.mjs`  
Expected: FAIL

**Step 3: 实现最小改动**

- `BackgroundManager` 保留并固定 `fitMode=WIDTH_PRIORITY_STRETCH_HEIGHT`
- 删除无关适配分支中的冗余逻辑（避免多策略并行）
- 保证远程图替换始终走 `changeBackground()`，触发重新适配

**Step 4: 复跑测试**

Run: `node --test tests/scene-contract/*.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assets/scripts/ui/common/BackgroundManager.ts assets/scripts/core/GameBootstrap.ts
git commit -m "refactor(adaptation): 背景适配统一走 BackgroundManager"
```

---

### Task 4: 引入 SafeArea + Widget 的交互层容器

**Files:**
- Modify: `assets/scenes/MainScene.scene`
- Modify: `assets/scenes/MultiPlayerScene.scene`

**Step 1: 写失败测试（两场景必须存在 SafeArea 交互根）**

```javascript
test('MainScene and MultiPlayerScene contain SafeArea interaction roots', () => {
  // 检查存在 SafeAreaRoot 节点 + SafeArea + Widget
});
```

**Step 2: 运行测试，确认失败**

Run: `node --test tests/scene-contract/adaptation.contract.test.mjs`  
Expected: FAIL

**Step 3: 实现最小改动**

- MainScene：新增 `SafeAreaRoot`，承载顶栏/按钮等交互节点（背景仍在安全区外）
- MultiPlayerScene：新增或复用安全区根，承载 `BackButton`、顶部 HUD、底部关键按钮
- 对交互节点统一加 Widget（target = 安全区根或 Canvas）

**Step 4: 复跑测试**

Run: `node --test tests/scene-contract/*.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assets/scenes/MainScene.scene assets/scenes/MultiPlayerScene.scene
git commit -m "refactor(adaptation): 引入 SafeArea 交互层与 Widget 约束"
```

---

### Task 5: 实现分端 UI 偏移配置（借鉴文章 UIAdaptor 思路）

**Files:**
- Create: `assets/scripts/ui/common/UIAdaptorProfile.ts`
- Modify: `assets/scenes/MainScene.scene`
- Modify: `assets/scenes/MultiPlayerScene.scene`

**Step 1: 写失败测试（关键节点必须挂 Profile 适配脚本）**

```javascript
test('critical top/bottom nodes have UIAdaptorProfile', () => {
  // Main: profile/rank/single_play
  // Multi: BackButton/DrawMoreButton/GameInfoHUD
});
```

**Step 2: 运行测试，确认失败**

Run: `node --test tests/scene-contract/adaptation.contract.test.mjs`  
Expected: FAIL

**Step 3: 实现最小改动**

- `UIAdaptorProfile.ts`：按宽高比分档（base / tall / tablet）
- 支持配置：`top/left/right/bottom`、`size`、`scale`、`fontSize`
- 启动与 resize 时执行 `widget.updateAlignment()`

**Step 4: 复跑测试**

Run: `node --test tests/scene-contract/*.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assets/scripts/ui/common/UIAdaptorProfile.ts assets/scenes/MainScene.scene assets/scenes/MultiPlayerScene.scene
git commit -m "feat(adaptation): 新增分端 UI 偏移配置组件"
```

---

### Task 6: 九宫格治理（所有可变宽按钮/条形背景）

**Files:**
- Modify: `assets/scenes/MainScene.scene`
- Modify: `assets/scenes/MultiPlayerScene.scene`
- Modify: `docs/UI_SETUP_GUIDE.md`

**Step 1: 写失败测试（关键节点 Sprite.Type 必须为 Sliced）**

```javascript
test('stretchable button backgrounds use sliced sprite', () => {
  // 检查关键按钮背景节点的 Sprite.type
});
```

**Step 2: 运行测试，确认失败**

Run: `node --test tests/scene-contract/background.contract.test.mjs`  
Expected: FAIL

**Step 3: 实现最小改动**

- 将会被横向拉伸的按钮背景改为 `Sprite Type = Sliced`
- 在文档中记录九宫格切线规范（1x/2x/3x 选型规则）

**Step 4: 复跑测试**

Run: `node --test tests/scene-contract/*.test.mjs`  
Expected: PASS

**Step 5: Commit**

```bash
git add assets/scenes/MainScene.scene assets/scenes/MultiPlayerScene.scene docs/UI_SETUP_GUIDE.md
git commit -m "refactor(ui): 可拉伸背景统一切换九宫格"
```

---

### Task 7: 构建与真机验收矩阵

**Files:**
- Create: `docs/UI_ADAPTATION_RUNBOOK.md`
- Modify: `docs/plans/2026-02-21-ui-adaptation-refactor-implementation-plan.md`

**Step 1: 写失败测试（构建产物策略检查脚本）**

```bash
# 预期读取构建产物并校验 designResolution policy / fit flags
node scripts/check-adaptation-build.mjs
```

**Step 2: 运行，确认失败**

Expected: FAIL（脚本不存在）

**Step 3: 实现最小脚本与验收文档**

- 新建 `scripts/check-adaptation-build.mjs`（检查 `build/wechatgame-001/src/settings.json`）
- 新建 runbook：iPhone6 / iPhone12 / iPad 三机位截图对比步骤与通过标准

**Step 4: 执行验收**

Run:
- `node --test tests/scene-contract/*.test.mjs`
- `node scripts/check-adaptation-build.mjs`

Expected:
- 全部 PASS
- 构建产物策略与项目策略一致

**Step 5: Commit**

```bash
git add scripts/check-adaptation-build.mjs docs/UI_ADAPTATION_RUNBOOK.md docs/plans/2026-02-21-ui-adaptation-refactor-implementation-plan.md
git commit -m "docs(adaptation): 增加真机验收矩阵与构建检查"
```

---

## 验收标准（Definition of Done）

- iPhone 6 / iPhone 12 / iPad：背景“宽不裁切”、无黑边，高度不足时仅纵向补拉伸。
- MainScene 与 MultiPlayerScene 顶部/底部核心交互在安全区内，无遮挡与误触。
- 可变宽按钮/条形背景无圆角拉伸变形。
- 重构后适配规则可通过契约测试与构建检查自动验证。

