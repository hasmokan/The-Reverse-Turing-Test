## 1. ResourceLoader 几何复用实现

- [x] 1.1 在 `ResourceLoader` 中新增模板化 `SpriteFrame` 构建 helper（复用 rect/offset/originalSize/rotation）
- [x] 1.2 在 `applyMappedSpriteFrames` 中接入模板复用逻辑，并保持 `BackgroundManager` 分支行为不变
- [x] 1.3 增加纹理尺寸兼容校验，不兼容时回退到纯纹理 `SpriteFrame` 并输出告警日志

## 2. 契约测试补强

- [x] 2.1 更新 `tests/scene-contract/remote-ui-loader.contract.test.mjs`，新增“模板几何复用路径”断言
- [x] 2.2 在同一测试文件新增“不兼容回退路径”断言
- [x] 2.3 调整现有断言以匹配新实现，确保不与旧赋值方式耦合

## 3. 验证与交付

- [x] 3.1 运行 `npm run test:scene-contract` 并确认通过
- [ ] 3.2 在微信开发者工具验证 `DrawMoreButton` 真机显示与编辑器一致
- [x] 3.3 记录变更影响与回退方式，供后续发布使用
