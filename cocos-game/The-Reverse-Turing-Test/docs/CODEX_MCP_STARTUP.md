# Codex 连接 Cocos MCP 启动说明

## 1) 先说结论（为什么我刚才没用上 MCP）

不是你的 MCP 没开。

我前面没连上的根因是：

1. **当前 Codex 会话在受限沙箱里运行**，普通命令对本地 `127.0.0.1:3000` 的访问会被拦截（需要提权/批准）。
2. 我最开始用的是未提权探测，所以看到“连不上”。
3. 你面板里的“连接数 0”不代表不可用（这个插件里该字段不是可靠在线连接计数）。

后来提权后已验证：`POST /mcp` 初始化返回 `200`，服务可用。

---

## 2) 一次性配置（只做一次）

确保 Codex 注册了这个 MCP：

```bash
codex mcp add cocos-creator --url http://127.0.0.1:3000/mcp
codex mcp list
```

如果已存在，可用：

```bash
codex mcp get cocos-creator
```

应看到：
- transport: `streamable_http`
- url: `http://127.0.0.1:3000/mcp`

---

## 3) 每次启动 Codex 的标准顺序

1. 在 Cocos Creator 的 MCP 面板里点击“启动服务器”（端口 3000）。
2. 用下面命令做健康检查（推荐）：

```bash
curl -sS http://127.0.0.1:3000/api/tools | head
```

或 MCP 初始化检查：

```bash
curl -i -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
```

3. 再启动 `codex` 并开始任务。

---

## 4) 如果我再次说“连不上”时怎么处理

请直接让我执行这类命令并**允许提权**（关键）：

- `curl http://127.0.0.1:3000/api/tools`
- `curl -X POST http://127.0.0.1:3000/mcp ...`

因为在受限沙箱模式下，本地回环请求也可能被拦截；提权后即可正常访问。

---

## 5) 给 Codex 的开场提示（可复制）

每次新会话开场你可以发：

```text
本项目使用 Cocos MCP（http://127.0.0.1:3000/mcp）。
若你探测本地 MCP 失败，请直接使用提权命令重试，不要根据“连接数=0”判断服务不可用。
优先检查 /api/tools 和 POST /mcp initialize。
```
