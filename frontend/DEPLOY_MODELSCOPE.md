# 创空间 (ModelScope) 前端部署指南

## 部署步骤

### 1. 准备文件

在创空间项目中，需要使用 `frontend/Dockerfile.modelscope` 作为 Dockerfile。

**方法 A：重命名文件**
```bash
# 在 frontend 目录下
cp Dockerfile.modelscope Dockerfile
```

**方法 B：在创空间配置中指定 Dockerfile 路径**
如果创空间支持指定 Dockerfile 路径，可以指向 `frontend/Dockerfile.modelscope`

### 2. 配置构建参数

在创空间的构建配置中，设置以下环境变量（Build Args）：

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `NEXT_PUBLIC_API_URL` | ✅ | 后端 API 地址 | `https://your-backend.binaliang.com` |
| `NEXT_PUBLIC_WS_URL` | ✅ | WebSocket 地址 | `wss://your-backend.binaliang.com` |
| `NEXT_PUBLIC_VISION_API_URL` | ❌ | AI 视觉 API | `https://api.openai.com/v1` |
| `NEXT_PUBLIC_VISION_API_KEY` | ❌ | AI 视觉 API Key | `sk-xxx` |
| `NEXT_PUBLIC_VISION_MODEL` | ❌ | 视觉模型名称 | `gpt-4-vision-preview` |

### 3. 创空间配置示例

在创空间的 `README.md` 或配置文件中：

```yaml
# 端口配置（创空间要求）
port: 7860

# 构建参数
build_args:
  NEXT_PUBLIC_API_URL: "https://your-backend-url"
  NEXT_PUBLIC_WS_URL: "wss://your-backend-url"
```

### 4. 本地测试

在部署到创空间前，可以本地测试：

```bash
cd frontend

# 构建镜像
docker build \
  -f Dockerfile.modelscope \
  --build-arg NEXT_PUBLIC_API_URL="https://your-backend.com" \
  --build-arg NEXT_PUBLIC_WS_URL="wss://your-backend.com" \
  -t mimic-frontend:modelscope .

# 运行测试
docker run -p 7860:7860 mimic-frontend:modelscope

# 访问 http://localhost:7860
```

## 注意事项

1. **端口**：创空间对外只开放 7860 端口，Dockerfile 已配置
2. **持久化**：如需持久化数据，使用 `/mnt/workshop` 目录（本前端应用无需持久化）
3. **环境变量**：`NEXT_PUBLIC_*` 变量必须在**构建时**传入（不是运行时），因为 Next.js 在构建时会将其嵌入到客户端代码中

## 故障排查

### 502 Bad Gateway
- 检查容器是否正常启动
- 确认端口是否为 7860

### API 请求失败
- 检查 `NEXT_PUBLIC_API_URL` 是否正确配置
- 确认后端服务是否支持 CORS 跨域请求

### WebSocket 连接失败
- 检查 `NEXT_PUBLIC_WS_URL` 是否使用 `wss://`（HTTPS 环境）
- 确认后端 WebSocket 服务是否正常
