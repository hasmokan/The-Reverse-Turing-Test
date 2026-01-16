# n8n 工作流配置指南

## 导入工作流

1. 访问 n8n: http://localhost:5678
2. 点击左侧菜单 **Workflows** → **Import from File**
3. 选择 `n8n-workflow.json`

## 配置 API 凭证

导入后需要配置 Zenmux API 凭证：

1. 点击 **Settings** → **Credentials**
2. 点击 **Add Credential** → **Header Auth**
3. 配置:
   - **Name**: `Zenmux API`
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer sk-ai-v1-e6c5428815770b31e53348538a2a1c0415a09071292199a920c0f2f031871fa6`
4. 保存

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
N8N_WEBHOOK_URL=http://mimic-n8n:5678/webhook/mimic-ai-generate
```
