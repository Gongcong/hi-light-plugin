# HiLight 安装说明

## 安装前准备

先确认电脑里有这两个工具：

- `Node.js`（建议 22 或更高）
- `OpenClaw`

在终端里输入下面两行，能看到版本号就说明已经装好：

```bash
node -v
openclaw --version
```

## 版本兼容

- 插件 2.1.0 及以上：需要 OpenClaw ≥ 2026.8.1
- 插件 2.0.x：适用于 2026.8.1 之前的旧版 OpenClaw

## 安装步骤（源码安装）

### 1. 准备源码

```bash
git clone <你的仓库地址>
cd hi-light-plugin
```

如果你已经在插件源码目录里了，可以跳过这一步。

### 2. 安装依赖并打包

```bash
npm install
npm run build
```

### 3. 用本地源码安装到 OpenClaw

把下面命令里的路径改成你电脑上的插件目录绝对路径：

```bash
openclaw plugins install --link /绝对路径/hi-light-plugin
```

如果提示 `requires capability consent`（OpenClaw ≥ 2026.8.1），追加 `--accept-capabilities` 后重试。

### 4. 打开配置文件

编辑文件：`~/.openclaw/openclaw.json`

把下面这段加到 `channels` 里（没有就新建）：

```json
{
  "channels": {
    "hi-light": {
      "enabled": true,
      "wsUrl": "ws://你的服务地址:8080/ws",
      "authToken": "你的API KEY",
      "dmPolicy": "open",
      "allowFrom": [
        "*"
      ]
    }
  }
}
```

`authToken` 原样填写 API KEY 即可，不需要加 `Bearer` 前缀。
`dmPolicy` 和 `allowFrom` 必须按上面填写，否则私聊消息会被拦截。

### 5. 重启网关让配置生效

```bash
openclaw gateway restart
```

## 安装完成怎么检查

重启后如果没有报错，基本就安装成功了。  
如果想更稳妥，可以看网关日志里是否出现 `hi-light` 连接成功的信息。
