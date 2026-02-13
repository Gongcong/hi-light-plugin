# HiLight 插件开发者接入指南

`hi-light` 是 OpenClaw 的 WebSocket 通道插件。它以 **WebSocket 客户端**身份连接你的业务服务端，将用户消息转发给 OpenClaw Agent，并把 Agent 最终回复回传给你的服务。

## 1. 通过 npm 使用（推荐）

### 1.1 安装

```bash
npm i @openclaw/hi-light
```

### 1.2 在 OpenClaw 中启用插件

```bash
openclaw plugins install @openclaw/hi-light
```

编辑 `~/.openclaw/openclaw.json`，添加：

```json
{
  "channels": {
    "hi-light": {
      "enabled": true,
      "wsUrl": "ws://your-service:8080/ws",
      "authToken": "Bearer your-secret-token",
      "reconnectIntervalMs": 3000,
      "maxReconnectIntervalMs": 30000,
      "dmPolicy": "open"
    }
  }
}
```

重启网关：

```bash
openclaw gateway restart
```

## 2. 本地开发安装（link）

```bash
cd extensions/hi-light
npm install
npm run build
openclaw plugins install --link /absolute/path/to/extensions/hi-light
```

## 3. 通信协议

所有消息统一格式：

```json
{
  "context": "会话标识",
  "action": "消息类型",
  "payload": {}
}
```

### 3.1 服务端 -> 插件

#### `action=msg`

用途：把一条用户输入交给 Agent 处理。

```json
{
  "context": "conv-001",
  "action": "msg",
  "payload": {
    "userId": "u-1001",
    "userName": "Alice",
    "text": "帮我总结今天的站会内容"
  }
}
```

字段说明：

- `context`：你定义的会话 ID（建议同一会话固定）。
- `payload.userId`：用户唯一标识。
- `payload.text`：用户输入文本。
- `payload.userName`：可选展示名。

#### `action=pong`

用途：回应插件发出的心跳 `ping`。

```json
{
  "context": "",
  "action": "pong",
  "payload": { "ts": 1739433852000 }
}
```

### 3.2 插件 -> 服务端

#### `action=connected`

插件连接成功后立即发送。

```json
{
  "context": "",
  "action": "connected",
  "payload": {
    "pluginId": "hi-light",
    "accountId": "default"
  }
}
```

#### `action=ping`

每 30 秒发送一次心跳，服务端应回复 `pong`。

#### `action=typing`

Agent 开始处理时发送，表示“正在思考”。

```json
{
  "context": "conv-001",
  "action": "typing",
  "payload": { "userId": "u-1001" }
}
```

#### `action=reply`

Agent 完整结果（非流式，整段一次性返回）。

```json
{
  "context": "conv-001",
  "action": "reply",
  "payload": {
    "userId": "u-1001",
    "text": "这是总结结果...",
    "done": true
  }
}
```

#### `action=error`

转发或处理失败。

```json
{
  "context": "conv-001",
  "action": "error",
  "payload": {
    "userId": "u-1001",
    "code": "DISPATCH_FAILED",
    "message": "具体错误信息"
  }
}
```

## 4. 服务端实现建议

### 4.1 连接地址规则

插件连接 `wsUrl` 时会自动追加一个随机 UUID 后缀，最终地址类似：

```text
ws://your-service:8080/ws/<uuid>
```

如果 `wsUrl` 中包含占位符 `{UUIDD}`，插件会替换该占位符，而不是追加路径。

### 4.2 鉴权

如果配置了 `authToken`，插件会在握手头中添加：

```text
Authorization: <authToken>
```

推荐直接把值配置为 `Bearer xxx`。

### 4.3 重连

插件内置指数退避重连：

- 初始间隔：`reconnectIntervalMs`（默认 `3000`）
- 上限：`maxReconnectIntervalMs`（默认 `30000`）

### 4.4 回包策略

插件对 Agent 输出做了缓冲，最终只发送一条 `action=reply`（`done=true`）。

## 5. 发布到 npm（维护者）

```bash
npm login
npm run build
npm publish --access public
```

发布前建议先检查打包内容：

```bash
npm pack --dry-run
```

## 6. 对接清单（上线前）

- OpenClaw 已安装并启用 `hi-light`。
- 你的 WS 服务能接受客户端连接，并支持 JSON 消息。
- 你的服务能处理 `connected/ping/typing/reply/error`。
- 你的服务能发送 `msg`，并在收到 `ping` 时回复 `pong`。
- 日志中可追踪 `context` 与 `userId` 全链路。

## 7. 目录结构

```text
extensions/hi-light/
├── index.ts
├── openclaw.plugin.json
├── package.json
├── test-ws-server.mjs
├── test-ws-connect.mjs
└── src/
    ├── accounts.ts
    ├── bot.ts
    ├── channel.ts
    ├── monitor.ts
    ├── reply-dispatcher.ts
    ├── runtime.ts
    ├── send.ts
    └── types.ts
```
