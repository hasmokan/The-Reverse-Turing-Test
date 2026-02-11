# 画板功能使用说明

## 功能概述

在单人游戏场景中，玩家可以使用画板绘制自己的鱼，绘制完成后，手绘的鱼会自动添加到鱼缸中游动。

## 组件说明

### 1. DrawingBoard（画板组件）

**路径**: `assets/scripts/ui/DrawingBoard.ts`

**功能**:
- 支持触摸/鼠标绘画
- 可自定义画笔大小和颜色
- 提供清空和提交功能
- 将绘画内容转换为纹理

**属性**:
- `drawingCanvas`: 画布节点（Graphics 组件所在节点）
- `graphics`: Graphics 组件引用
- `clearButton`: 清空按钮
- `submitButton`: 提交按钮
- `camera`: 用于渲染纹理的相机
- `brushSize`: 画笔大小（默认 5）
- `brushColor`: 画笔颜色（默认黑色）

**方法**:
- `setBrushSize(size: number)`: 设置画笔大小
- `setBrushColor(color: Color)`: 设置画笔颜色
- `clearCanvas()`: 清空画布
- `captureSpriteFrame()`: 捕获画布内容为纹理

**事件**:
- `drawing-completed`: 绘画完成时触发，传递 SpriteFrame

### 2. CustomFish（自定义鱼组件）

**路径**: `assets/scripts/game/CustomFish.ts`

**功能**:
- 使用玩家绘制的纹理作为外观
- 自动在鱼缸中随机游动
- 智能避开边界
- 根据游动方向自动翻转

**属性**:
- `fishSprite`: Sprite 组件引用
- `swimSpeed`: 游动速度（默认 50）
- `swimRadius`: 游动半径（默认 100）

**方法**:
- `setTexture(spriteFrame: SpriteFrame)`: 设置鱼的外观纹理
- `stopSwimming()`: 停止游动

### 3. FishSpawner（鱼生成器）

**路径**: `assets/scripts/game/FishSpawner.ts`

**功能**:
- 接收画板的绘画结果
- 生成自定义鱼实例
- 管理鱼的数量上限
- 自动清理超出限制的旧鱼

**属性**:
- `fishPrefab`: 鱼预制体（可选）
- `fishContainer`: 鱼容器节点
- `drawingBoard`: 画板节点引用
- `maxFishCount`: 最大鱼数量（默认 10）

**方法**:
- `spawnCustomFish(spriteFrame: SpriteFrame)`: 生成自定义鱼
- `clearAllFish()`: 清除所有鱼
- `getFishCount()`: 获取当前鱼数量

## Cocos Creator 编辑器配置步骤

### 1. 设置画板节点

1. 在 `SinglePlayerScene` 中创建以下节点结构：

```
Canvas
├── DrawingBoardPanel (添加 DrawingBoard 组件)
│   ├── DrawingCanvas (添加 Graphics 组件)
│   ├── ClearButton (添加 Button 组件)
│   └── SubmitButton (添加 Button 组件)
├── FishContainer (用于容纳所有鱼)
└── SpawnerNode (添加 FishSpawner 组件)
```

2. 配置 `DrawingBoard` 组件：
   - 将 `DrawingCanvas` 拖到 `drawingCanvas` 属性
   - 将 Graphics 组件拖到 `graphics` 属性
   - 将 `ClearButton` 拖到 `clearButton` 属性
   - 将 `SubmitButton` 拖到 `submitButton` 属性
   - 将场景相机拖到 `camera` 属性

3. 配置 `DrawingCanvas` 节点：
   - 添加 UITransform 组件
   - 设置合适的大小（例如 400x400）
   - 添加 Graphics 组件

4. 配置按钮：
   - 为 `ClearButton` 和 `SubmitButton` 添加 Label 子节点
   - 设置按钮文本："清空" 和 "完成"

### 2. 设置鱼生成器

1. 配置 `FishSpawner` 组件：
   - 将 `DrawingBoardPanel` 拖到 `drawingBoard` 属性
   - 将 `FishContainer` 拖到 `fishContainer` 属性
   - 设置 `maxFishCount`（推荐 5-10）

2. （可选）创建鱼预制体：
   - 创建一个节点，添加 Sprite 和 CustomFish 组件
   - 设置 UITransform 大小（例如 100x100）
   - 保存为预制体
   - 将预制体拖到 `fishPrefab` 属性

### 3. UI 布局建议

**画板位置**:
- 建议放在屏幕下方或侧边
- 可以使用 Widget 组件对齐

**画布大小**:
- 推荐 300x300 到 500x500 之间
- 确保用户可以舒适绘画

**鱼缸区域**:
- 画板以外的区域都可以作为鱼缸
- FishContainer 的 UITransform 决定鱼的活动范围

## 使用流程

1. 玩家在画板上绘制自己的鱼
2. 点击"清空"按钮可以重新绘制
3. 点击"完成"按钮提交绘画
4. 系统自动将绘画转换为纹理
5. 生成一条使用该纹理的鱼
6. 鱼开始在鱼缸中自动游动
7. 可以继续绘制更多的鱼

## 扩展功能建议

### 1. 画笔工具栏

可以添加 UI 面板让玩家选择：
- 画笔大小（细/中/粗）
- 画笔颜色（调色板）
- 橡皮擦工具

```typescript
// 示例：添加颜色选择
const drawingBoard = node.getComponent(DrawingBoard);
drawingBoard.setBrushColor(new Color(255, 0, 0, 255)); // 红色
```

### 2. 鱼的属性

可以扩展 CustomFish 组件：
- 不同的游动速度
- 不同的大小
- 交互功能（点击鱼弹出信息）

### 3. 保存与分享

可以添加功能：
- 保存绘画到本地
- 导出为图片
- 分享给其他玩家

### 4. 游戏化元素

- 限制每日可绘制的鱼数量
- 给鱼添加名字
- 鱼的成长系统
- 鱼缸装饰

## 注意事项

1. **性能优化**:
   - 建议 `maxFishCount` 不要设置太大（推荐 5-10）
   - 鱼的游动使用了 Tween 动画，较为高效

2. **纹理管理**:
   - RenderTexture 会占用内存
   - 组件会在销毁时自动清理

3. **触摸事件**:
   - 确保画板节点的层级正确
   - 不要被其他 UI 元素遮挡

4. **相机设置**:
   - 必须为 DrawingBoard 组件指定相机
   - 用于捕获画布内容为纹理

## 调试技巧

1. **查看日志**:
```typescript
// DrawingBoard 会输出这些日志
console.log('提交绘画，生成自定义鱼');
console.log('成功捕获画布内容为纹理');

// FishSpawner 会输出
console.log('收到绘画完成事件，准备生成鱼');
console.log('成功生成自定义鱼，当前鱼数量: X');
```

2. **常见问题**:
   - 画不上内容：检查 Graphics 组件是否正确配置
   - 鱼没有生成：检查 FishSpawner 的 drawingBoard 引用
   - 鱼不显示：检查相机的 targetTexture 设置
   - 鱼不游动：检查 CustomFish 的 start 方法是否被调用

## 代码示例

### 手动触发生成鱼

```typescript
// 获取组件
const spawner = this.node.getComponent(FishSpawner);
const drawingBoard = this.drawingBoardNode.getComponent(DrawingBoard);

// 捕获画布并生成鱼
const spriteFrame = drawingBoard.captureSpriteFrame();
if (spriteFrame) {
    spawner.spawnCustomFish(spriteFrame);
}
```

### 自定义鱼的行为

```typescript
// 获取鱼组件
const customFish = fishNode.getComponent(CustomFish);

// 修改游动速度
customFish.swimSpeed = 100;

// 停止游动
customFish.stopSwimming();
```

## 总结

这套画板系统提供了完整的绘画到生成鱼的流程，具有良好的扩展性。通过简单的配置即可在 Cocos Creator 编辑器中使用，适合快速集成到游戏中。
