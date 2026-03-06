/**
 * Interactive test WS server for hi-light plugin.
 * Uses the { context, action, payload } protocol.
 *
 * Run: node test-ws-server.mjs
 *
 * After a client connects, type any message in the terminal and press Enter
 * to send it to the plugin as a user message. You can send multiple messages.
 */
import { createInterface } from "node:readline";
import { WebSocketServer } from "ws";

const PORT = 9100;
const wss = new WebSocketServer({ port: PORT });

/** Track connected clients */
let activeWs = null;
let msgSeq = 0;

console.log(`[test-ws-server] Listening on ws://127.0.0.1:${PORT}`);
console.log(`[test-ws-server] Waiting for plugin to connect...\n`);

wss.on("connection", (ws, req) => {
  const auth = req.headers["authorization"] ?? "(none)";
  console.log(`[test-ws-server] ✅ Client connected! Auth: ${auth}`);
  activeWs = ws;

  // Prompt for input
  console.log(`\n💡 输入消息内容后按回车发送（可多次输入），输入 quit 退出\n`);

  ws.on("message", (data) => {
    const raw = data.toString();

    try {
      const envelope = JSON.parse(raw);
      const { context, action, payload } = envelope;

      switch (action) {
        case "connected":
          console.log(`[test-ws-server] ✅ Plugin connected: ${payload.pluginId || 'unknown'}`);
          console.log(`[test-ws-server] Payload:`, JSON.stringify(payload));
          break;

        case "ping":
          // Reply with pong silently
          ws.send(JSON.stringify({ context: "", action: "pong", payload: { ts: payload.ts } }));
          break;

        case "typing":
          console.log(`[test-ws-server] ✏️  Agent is typing... (user=${payload.userId})`);
          break;

        case "reply":
          console.log(`\n[test-ws-server] 🤖 Agent reply (context=${context}):`);
          console.log(`    ${payload.text}`);
          console.log(`\n💡 继续输入消息，或输入 quit 退出\n`);
          break;

        case "error":
          console.error(`[test-ws-server] ❌ Error: [${payload.code}] ${payload.message}`);
          break;

        default:
          console.log(`[test-ws-server] Unknown action: ${action}`, raw);
      }
    } catch {
      console.log(`[test-ws-server] Non-JSON: ${raw}`);
    }
  });

  ws.on("close", (code) => {
    console.log(`[test-ws-server] Client disconnected (code=${code})`);
    if (activeWs === ws) activeWs = null;
  });
});

// ── Interactive stdin input ──────────────────────────────────────────

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "📝 发送消息> ",
});

rl.prompt();

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) {
    rl.prompt();
    return;
  }

  if (text === "quit" || text === "exit") {
    console.log("[test-ws-server] Bye!");
    process.exit(0);
  }

  if (!activeWs) {
    console.log("[test-ws-server] ⚠️  没有客户端连接，无法发送");
    rl.prompt();
    return;
  }

  msgSeq++;
  const envelope = {
    context: `interactive-${msgSeq}`,
    action: "msg",
    payload: {
      userId: "test-user-001",
      userName: "测试用户",
      text,
    },
  };

  console.log(`[test-ws-server] 📤 发送消息 #${msgSeq}: "${text}"`);
  activeWs.send(JSON.stringify(envelope));
  rl.prompt();
});

rl.on("close", () => {
  console.log("\n[test-ws-server] Bye!");
  process.exit(0);
});
