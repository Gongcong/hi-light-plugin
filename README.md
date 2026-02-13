# HiLight Plugin 安装说明

## 安装方法

OpenClaw安装： https://github.com/openclaw/openclaw#install-recommended

插件安装：https://my.feishu.cn/wiki/CO5Vw6cG9iZUpckIvJoc279VnFc

## 安装前准备

先确认电脑里有这两个工具：

- `Node.js`（建议 18 或更高）
- `OpenClaw`

在终端里输入下面两行，能看到版本号就说明已经装好：

```bash
node -v
openclaw --version
```

## 安装步骤（源码安装）

### 1. 准备源码

```bash
git clone git@github.com:Gongcong/hi-light-plugin.git
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

### 4. 打开配置文件

编辑文件：`~/.openclaw/openclaw.json`

把下面这段加到 `channels` 里（没有就新建）：

```json
"channels": {
    "hi-light": {
      "enabled": true,
      "wsUrl": "ws://你的服务地址:8080/ws",
      "authToken": "你的API KEY"
    }
}
```

API KEY 获取方式：

各大应用商店，下载 HiLight APP，点击设置 -> 帐号管理  -> 获取 API KEY


<img src="https://github.com/user-attachments/assets/6b55651c-ac08-432f-948b-3f82902839c4" alt="API KEY 获取示意图" width="420" />


### 5. 重启网关让配置生效

```bash
openclaw gateway restart
```

## 安装完成怎么检查

重启后如果没有报错，基本就安装成功了。  
如果想更稳妥，可以看网关日志里是否出现 `hi-light` 连接成功的信息。
