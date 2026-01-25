# Cocos Creator UI 组件配置指南

本指南将帮助你在 Cocos Creator 3.8.8 中配置已创建的 UI 组件。

---

## 📋 目录

1. [GameInfoHUD - 游戏信息 HUD](#1-gameinfohud---游戏信息-hud)
2. [VoteDisplay - 票数显示](#2-votedisplay---票数显示)
3. [FishDetailPanel - 鱼详情面板](#3-fishdetailpanel---鱼详情面板)
4. [GameResultPanel - 游戏结果面板](#4-gameresultpanel---游戏结果面板)
5. [FloatingDamageManager - 浮动伤害](#5-floatingdamagemanager---浮动伤害)
6. [Fish Prefab - 鱼预制体](#6-fish-prefab---鱼预制体)

---

## 1. GameInfoHUD - 游戏信息 HUD

### 节点结构

```
GameInfoHUD (Node + GameInfoHUD.ts)
├── Background (Sprite) - 半透明背景
├── LeftSection (Node)
│   ├── AIIcon (Sprite) - AI 图标
│   ├── AICountLabel (Label) - "3"
│   ├── Separator (Label) - "|"
│   ├── HumanIcon (Sprite) - 玩家图标
│   └── HumanCountLabel (Label) - "8"
├── CenterSection (Node)
│   └── PhaseLabel (Label) - "投票阶段"
├── RightSection (Node)
│   ├── TurbidityLabel (Label) - "浑浊度: 40%"
│   ├── TurbidityBar (ProgressBar)
│   │   ├── Background (Sprite)
│   │   └── Bar (Sprite) - 进度填充
│   └── WarningIcon (Sprite) - ⚠️ 警告图标
```

### 配置步骤

1. **创建节点**
   - 在 Canvas 下创建空节点，命名为 `GameInfoHUD`
   - 设置锚点为 (0.5, 1)，位置在屏幕顶部

2. **添加背景**
   - 添加子节点 `Background`，添加 Sprite 组件
   - 设置为半透明黑色 (0, 0, 0, 150)
   - 宽度撑满屏幕，高度约 60px

3. **创建左侧区域**
   - 创建 `LeftSection` 节点
   - 添加 Layout 组件，Type = Horizontal，Spacing = 10
   - 添加 AI 图标和数量 Label

4. **创建中间区域**
   - 创建 `CenterSection` 节点
   - 添加 `PhaseLabel`，字体大小 24，居中

5. **创建右侧区域**
   - 创建 `RightSection` 节点
   - 添加 ProgressBar 组件用于浑浊度显示
   - 添加警告图标（默认隐藏）

6. **挂载脚本**
   - 选中 `GameInfoHUD` 节点
   - 在 Inspector 中添加 `GameInfoHUD` 脚本
   - 拖拽绑定所有 UI 引用

### 属性绑定

| 属性 | 绑定节点 |
|------|----------|
| aiCountLabel | LeftSection/AICountLabel |
| humanCountLabel | LeftSection/HumanCountLabel |
| phaseLabel | CenterSection/PhaseLabel |
| turbidityBar | RightSection/TurbidityBar |
| turbidityLabel | RightSection/TurbidityLabel |
| warningIcon | RightSection/WarningIcon |

---

## 2. VoteDisplay - 票数显示

### 节点结构

```
VoteDisplay (Node + VoteDisplay.ts) - 作为 Prefab
├── Background (Sprite) - 圆形气泡背景
├── CountLabel (Label) - "3"
└── ProgressRing (Node) - 可选
    └── ProgressFill (Sprite, Filled 模式)
```

### 配置步骤

1. **创建 Prefab**
   - 在 assets 文件夹创建 `prefabs` 文件夹
   - 创建空节点，命名为 `VoteDisplay`

2. **添加背景气泡**
   - 添加 `Background` 子节点
   - 添加 Sprite 组件，使用圆形图片
   - 大小约 40x40

3. **添加票数标签**
   - 添加 `CountLabel` 子节点
   - 添加 Label 组件
   - 字体大小 20，加粗，白色
   - 启用描边 (黑色, 宽度 2)

4. **添加进度环（可选）**
   - 添加 `ProgressRing` 节点
   - 子节点 `ProgressFill` 使用 Sprite
   - Sprite Type 设为 `Filled`
   - Fill Type 设为 `Radial`

5. **挂载脚本并保存 Prefab**
   - 添加 `VoteDisplay` 脚本
   - 绑定引用
   - 拖拽到 assets/prefabs 保存为 Prefab

### 属性绑定

| 属性 | 绑定节点 |
|------|----------|
| backgroundSprite | Background |
| countLabel | CountLabel |
| progressRing | ProgressRing |
| progressFill | ProgressRing/ProgressFill |

---

## 3. FishDetailPanel - 鱼详情面板

### 节点结构

```
FishDetailPanel (Node + FishDetailPanel.ts)
├── Mask (Node) - 半透明遮罩，点击关闭
├── Panel (Node) - 面板主体
│   ├── Header (Node)
│   │   ├── FishImage (Sprite) - 鱼的图片
│   │   ├── FishName (Label) - "小金鱼"
│   │   ├── Author (Label) - "作者: 玩家A"
│   │   └── CloseButton (Button)
│   ├── VoteSection (Node)
│   │   ├── VoteCount (Label) - "2 / 4"
│   │   ├── VoteProgressBar (ProgressBar)
│   │   └── VotersList (Label) - "投票者: A, B"
│   ├── Description (Label) - 描述文字
│   ├── ActionButton (Button) - 投票/追击/换目标
│   │   └── Label (Label)
│   └── CommentsSection (Node) - 评论区
│       └── CommentsList (Node)
```

### 配置步骤

1. **创建面板节点**
   - 在 Canvas 下创建 `FishDetailPanel` 节点
   - 设置为全屏大小
   - 默认隐藏 (Active = false)

2. **创建遮罩**
   - 添加 `Mask` 子节点，全屏大小
   - 添加 Sprite，颜色 (0, 0, 0, 180)
   - 添加 Button 组件（用于点击关闭）

3. **创建面板主体**
   - 添加 `Panel` 子节点
   - 大小约 350x500
   - 添加白色背景 Sprite
   - 可添加圆角效果

4. **创建头部区域**
   - 鱼图片 Sprite (150x150)
   - 名称 Label (字体 24, 加粗)
   - 作者 Label (字体 16, 灰色)
   - 关闭按钮 (右上角 X)

5. **创建投票区域**
   - 票数 Label
   - ProgressBar 显示进度
   - 投票者列表 Label

6. **创建操作按钮**
   - 添加 Button 组件
   - 大小约 200x50
   - 子节点 Label 显示按钮文字

7. **挂载脚本**
   - 添加 `FishDetailPanel` 脚本
   - 绑定所有引用

### 属性绑定

| 属性 | 绑定节点 |
|------|----------|
| panelRoot | Panel |
| maskNode | Mask |
| fishImage | Panel/Header/FishImage |
| fishNameLabel | Panel/Header/FishName |
| authorLabel | Panel/Header/Author |
| voteCountLabel | Panel/VoteSection/VoteCount |
| votersLabel | Panel/VoteSection/VotersList |
| voteProgressFill | Panel/VoteSection/VoteProgressBar/Bar |
| actionButton | Panel/ActionButton |
| actionButtonLabel | Panel/ActionButton/Label |
| closeButton | Panel/Header/CloseButton |

---

## 4. GameResultPanel - 游戏结果面板

### 节点结构

```
GameResultPanel (Node + GameResultPanel.ts)
├── Mask (Node) - 背景遮罩
├── Panel (Node) - 面板主体
│   ├── TitleSection (Node)
│   │   ├── TitleIcon (Sprite) - 胜利/失败图标
│   │   └── TitleLabel (Label) - "🎉 胜利！"
│   ├── VictoryEffects (Node) - 胜利特效
│   ├── DefeatEffects (Node) - 失败特效
│   ├── MVPSection (Node) - MVP 区域
│   │   ├── MVPAvatar (Sprite)
│   │   ├── MVPName (Label)
│   │   └── MVPTitle (Label) - "🏆 最有价值玩家"
│   ├── StatsSection (Node) - 统计区域
│   │   ├── AIRemaining (Label) - "AI 剩余: 0"
│   │   ├── HumanRemaining (Label) - "人类剩余: 7"
│   │   └── HumanKilled (Label) - "误杀: 2"
│   ├── ReasonSection (Node) - 失败原因
│   │   └── ReasonLabel (Label)
│   └── ButtonsSection (Node)
│       ├── RestartButton (Button)
│       ├── LobbyButton (Button)
│       └── ShareButton (Button)
```

### 配置步骤

1. **创建面板节点**
   - 在 Canvas 下创建 `GameResultPanel`
   - 全屏大小，默认隐藏

2. **创建遮罩**
   - 深色半透明背景

3. **创建面板主体**
   - 居中显示
   - 大小约 400x550
   - 添加背景 Sprite

4. **创建标题区域**
   - 大号 Label (字体 36, 加粗)
   - 可添加图标 Sprite

5. **创建 MVP 区域**
   - 头像 Sprite (80x80)
   - 名称 Label
   - 称号 Label (金色)

6. **创建统计区域**
   - 使用 Layout 垂直排列
   - 多个 Label 显示数据

7. **创建按钮区域**
   - 使用 Layout 水平排列
   - 三个按钮：重新开始、返回大厅、分享

8. **挂载脚本**
   - 添加 `GameResultPanel` 脚本
   - 绑定所有引用

---

## 5. FloatingDamageManager - 浮动伤害

### 节点结构

```
FloatingDamageManager (Node + FloatingDamageManager.ts)
└── Container (Node) - 伤害数字容器

FloatingDamage Prefab:
└── FloatingDamage (Node)
    └── Label (Label) - "-1"
```

### 配置步骤

1. **创建管理器节点**
   - 在 Canvas 下创建 `FloatingDamageManager`
   - 添加 `Container` 子节点

2. **创建伤害数字 Prefab**
   - 创建空节点 `FloatingDamage`
   - 添加 Label 组件
   - 字体大小 32，加粗
   - 启用描边 (黑色, 宽度 3)
   - 保存为 Prefab

3. **挂载脚本**
   - 添加 `FloatingDamageManager` 脚本
   - 绑定 Prefab 和 Container

### 属性绑定

| 属性 | 绑定 |
|------|------|
| damagePrefab | assets/prefabs/FloatingDamage |
| container | Container 节点 |
| floatHeight | 80 |
| floatDuration | 0.8 |

---

## 6. Fish Prefab - 鱼预制体

### 节点结构

```
Fish (Node + FishController.ts)
├── FishSprite (Sprite) - 鱼的图片
└── VoteDisplay (VoteDisplay Prefab 实例)
```

### 配置步骤

1. **创建鱼节点**
   - 创建空节点 `Fish`
   - 大小约 100x100

2. **添加鱼图片**
   - 添加 `FishSprite` 子节点
   - 添加 Sprite 组件
   - 设置默认图片或留空

3. **添加票数显示**
   - 实例化 VoteDisplay Prefab
   - 或创建 VoteDisplay 子节点
   - 位置在鱼的上方

4. **挂载脚本**
   - 添加 `FishController` 脚本
   - 绑定引用

5. **保存为 Prefab**
   - 拖拽到 assets/prefabs

### 属性绑定

| 属性 | 绑定节点 |
|------|----------|
| fishSprite | FishSprite |
| voteDisplay | VoteDisplay |

---

## 🎯 场景配置清单

在场景中需要配置的节点：

```
scene
├── Canvas
│   ├── Camera
│   ├── Managers (空节点，持久化)
│   │   ├── GameManager (+ GameManager.ts)
│   │   ├── BattleSystem (+ BattleSystem.ts)
│   │   └── SocketClient (+ SocketClient.ts)
│   ├── GameStage (+ GameStage.ts)
│   │   ├── FishContainer (空节点，鱼的容器)
│   │   ├── BubbleContainer (空节点，气泡容器)
│   │   └── TurbidityMask (Sprite，浑浊度遮罩)
│   ├── UI (空节点)
│   │   ├── GameInfoHUD (+ GameInfoHUD.ts)
│   │   ├── CooldownHUD (+ CooldownHUD.ts)
│   │   ├── ToastContainer (+ ToastManager.ts)
│   │   └── FloatingDamageManager (+ FloatingDamageManager.ts)
│   ├── Popups (空节点，弹窗层)
│   │   ├── FishDetailPanel (+ FishDetailPanel.ts)
│   │   └── GameResultPanel (+ GameResultPanel.ts)
│   └── Main (+ Main.ts)
```

---

## ⚡ 快速配置技巧

### 1. 批量创建 Label
```
右键 -> Create -> UI -> Label
```

### 2. 使用 Layout 组件
- 自动排列子节点
- Type: Horizontal / Vertical
- 设置 Spacing 控制间距

### 3. 使用 Widget 组件
- 自动适配不同屏幕
- 设置 Left/Right/Top/Bottom 边距

### 4. 颜色快捷设置
- 胜利绿: #4CAF50
- 失败红: #F44336
- 警告黄: #FFC107
- 信息蓝: #2196F3

### 5. 字体推荐
- 标题: 24-36px, Bold
- 正文: 16-20px, Normal
- 数字: 20-32px, Bold

---

## 🔧 调试技巧

1. **检查脚本绑定**
   - 确保所有 @property 都已绑定
   - 未绑定会显示为 None

2. **检查节点激活状态**
   - 弹窗默认应该是 Active = false
   - 通过代码控制显示/隐藏

3. **检查层级顺序**
   - 弹窗应该在最上层
   - 使用 Sibling Index 调整

4. **控制台日志**
   - 查看 Console 面板的错误信息
   - 组件会输出 [ComponentName] 前缀的日志

---

## 📝 注意事项

1. **Prefab 修改**
   - 修改 Prefab 后记得 Apply
   - 或者在 Prefab 模式下编辑

2. **脚本引用**
   - 确保脚本文件没有语法错误
   - 保存后等待编译完成

3. **资源路径**
   - 图片资源放在 assets/textures
   - Prefab 放在 assets/prefabs

4. **性能优化**
   - 使用对象池复用节点
   - 避免频繁创建/销毁
