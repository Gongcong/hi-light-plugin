/**
 * 集成测试：直接调用 startHiLightMonitor，用错误 token 连真实 WSS，
 * 验证真实代码路径下的日志与重连/停止逻辑。
 * 运行：npm test -- src/monitor.integration.test.ts
 */
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { startHiLightMonitor } from "./monitor.js";

const WSS_URL = "wss://open.guangfan.com/open-apis/device-agent/v1/websocket";
const WRONG_TOKEN = "wrong-token-for-test";

/** 与插件运行时一致的 log，直接打到控制台便于观察 */
function createConsoleLog() {
  return {
    info: (msg: string) => console.log("[log info]", msg),
    warn: (msg: string) => console.log("[log warn]", msg),
    error: (msg: string) => console.log("[log error]", msg),
    debug: (msg?: string) => console.log("[log debug]", msg ?? ""),
  };
}

describe("startHiLightMonitor 集成（真实 WSS + 错误 token）", () => {
  let abort: AbortController;
  let log: ReturnType<typeof createConsoleLog>;

  beforeEach(() => {
    abort = new AbortController();
    log = createConsoleLog();
  });

  afterEach(() => {
    abort.abort();
  });

  it("调用真实 monitor，错误 token 时观察 close/重连或 401 停止日志", async () => {
    const config = {
      channels: {
        "hi-light": {
          enabled: true,
          wsUrl: WSS_URL,
          authToken: WRONG_TOKEN,
        },
      },
    } as Parameters<typeof startHiLightMonitor>[0]["config"];

    console.log("\n--- 开始：真实 startHiLightMonitor，错误 token，约 8s 后 abort ---\n");

    const monitorPromise = startHiLightMonitor({
      config,
      runtime: undefined,
      abortSignal: abort.signal,
      accountId: "integration-test",
      log,
    });

    // 8 秒后 abort，足以看到首次连接、close、以及一次重连或 401 停止
    const timeout = setTimeout(() => {
      console.log("\n--- 8s 到，abort 结束测试 ---\n");
      abort.abort();
    }, 8000);

    await monitorPromise;
    clearTimeout(timeout);
    console.log("--- startHiLightMonitor 已退出 ---\n");
  }, 15_000);
});
