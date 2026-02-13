# HiLight 安装说明

OpenClaw 安装：<https://github.com/openclaw/openclaw#install-recommended>

npm 包地址：<https://www.npmjs.com/package/@art_style666/hi-light>

## 安装前准备

先确认电脑里有这两个工具：

- `Node.js`（建议 18 或更高）
- `OpenClaw`

在终端里输入下面两行，能看到版本号就说明已经装好：

```bash
node -v
openclaw --version
```

## 安装方式

### 1. npm 安装（推荐）

```bash
npm i @art_style666/hi-light
openclaw plugins install @art_style666/hi-light
```

### 2. 源码安装（开发调试）

```bash
git clone git@github.com:Gongcong/hi-light-plugin.git
cd hi-light-plugin
npm install
npm run build
openclaw plugins install --link /绝对路径/hi-light-plugin
```

## 通用配置（两种安装方式都一样）

编辑文件：`~/.openclaw/openclaw.json`

把下面这段加到 `channels` 里（没有就新建）：

```json
"channels": {
  "hi-light": {
    "enabled": true,
    "wsUrl": "wss://open.guangfan.com/open-apis/device-agent/v1/websocket",
    "authToken": "你的API KEY"
  }
}
```

API KEY 获取方式：
各大应用商店下载 HiLight App，点击设置 -> 帐号管理 -> 获取 API KEY。

<img src="https://github.com/user-attachments/assets/6b55651c-ac08-432f-948b-3f82902839c4" alt="API KEY 获取示意图" width="420" />

## 让配置生效

```bash
openclaw gateway restart
```

## 安装完成怎么检查

重启后如果没有报错，基本就安装成功了。
如果想更稳妥，可以看网关日志里是否出现 `hi-light` 连接成功的信息。
