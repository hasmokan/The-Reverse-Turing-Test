## 变更影响

- 微信小游戏远程 UI 映射阶段新增“模板几何复用”逻辑：应用远程纹理时优先复用目标节点原 `SpriteFrame` 的 rect、offset、originalSize、rotation 与 inset 参数。
- 当模板几何与远程纹理尺寸不兼容时，系统回退为远程纹理直贴 `SpriteFrame`，并输出告警日志（包含 key 与 node）。
- `BackgroundManager` 分支保持不变，避免影响背景图适配逻辑。
- `tests/scene-contract/remote-ui-loader.contract.test.mjs` 已新增/调整契约断言，覆盖复用路径与回退路径。

## 回退方式

如需快速回退本次行为，可仅回退下列文件到变更前版本：

1. `cocos-game/The-Reverse-Turing-Test/assets/scripts/core/ResourceLoader.ts`
2. `cocos-game/The-Reverse-Turing-Test/tests/scene-contract/remote-ui-loader.contract.test.mjs`

回退后执行：

```bash
cd cocos-game/The-Reverse-Turing-Test
npm run test:scene-contract
```

确保测试全绿后再发版。
