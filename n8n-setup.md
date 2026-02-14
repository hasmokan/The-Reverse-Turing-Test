# n8n 工作流配置指南

## 当前状态

⚠️ **AI 生成功能当前已禁用**

原 Zenmux API 已不可用，系统目前使用预置鱼图片。
如需启用 AI 生成，请：
1. 配置可用的图像生成 API（本仓库 n8n workflow 默认使用 Zenmux OpenAI-compatible images endpoint）
2. 在 n8n 中导入并激活工作流
3. 设置环境变量 `AI_GENERATION_ENABLED=true`
4. 配置模型与尺寸（默认优先使用 nano banana pro）

## 导入工作流

1. 访问 n8n: http://localhost:5678
2. 点击左侧菜单 **Workflows** → **Import from File**
3. 选择 `n8n-workflow.json`

## 配置 API 凭证

导入后需要配置 AI 图像生成 API 凭证：

1. 点击 **Settings** → **Credentials**
2. 点击 **Add Credential** → **Bearer Auth**
3. 配置:
   - **Name**: `AI Image API`
   - **Token**: `<YOUR_API_TOKEN_HERE>`
4. 保存

> **注意**: 需要先获取有效的 API Token。请根据选择的 API 提供商获取凭证。

## 模型与速度/质量权衡（工作流参数）

该工作流包含 fast → quality → fallback 的分层重试策略，并会**优先选择 nano banana pro**（可通过环境变量覆盖）。

建议在 n8n 容器环境变量中配置（或通过 n8n 的环境变量注入方式）：

```
ZENMUX_MODEL_FAST=nano banana pro
ZENMUX_MODEL_QUALITY=nano banana pro
ZENMUX_MODEL_FALLBACK=google/gemini-3-pro-image-preview

ZENMUX_SIZE_FAST=256x256
ZENMUX_SIZE_QUALITY=512x512
ZENMUX_SIZE_FALLBACK=512x512
```

说明：
- fast：追求更快返回（更小尺寸、较短 timeout），用于“先生成能用的图”
- quality：更高分辨率与更长 timeout，失败时自动降级/回退
- fallback：当主模型/质量模型失败时启用的兜底模型

## 激活工作流

1. 打开导入的工作流
2. 点击右上角 **Activate** 开关
3. Webhook URL 将变为: `http://localhost:5678/webhook/mimic-ai-generate`

> 重要：后端触发 webhook 的 HTTP timeout 为 10 秒。该工作流已调整为“先快速响应，再后台生成并 callback”，避免后端因等待图片生成而超时。

## 验证

后端 `.env` 中需要配置:
```
N8N_WEBHOOK_URL=http://localhost:5678/webhook/mimic-ai-generate
```

如果 n8n 和后端都在 Docker 中，使用：
```
N8N_WEBHOOK_URL=http://n8n:5678/webhook/mimic-ai-generate
CALLBACK_BASE_URL=http://backend:3001
AI_GENERATION_ENABLED=true
```
