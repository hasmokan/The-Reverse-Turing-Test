# n8n 工作流配置指南

## 当前状态

⚠️ **AI 生成功能当前已禁用**

原 Zenmux API 已不可用，系统目前使用预置鱼图片。
如需启用 AI 生成，请：
1. 配置新的图像生成 API
2. 更新 n8n workflow 中的 API endpoint
3. 设置环境变量 `AI_GENERATION_ENABLED=true`

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

## 激活工作流

1. 打开导入的工作流
2. 点击右上角 **Activate** 开关
3. Webhook URL 将变为: `http://localhost:5678/webhook/mimic-ai-generate`

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
