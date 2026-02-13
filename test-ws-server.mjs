/**
 * Test WS server for hi-light plugin.
 * Uses the { context, action, payload } protocol.
 *
 * Run: node test-ws-server.mjs
 */
import { WebSocketServer } from "ws";

const PORT = 9100;
const wss = new WebSocketServer({ port: PORT });

console.log(`[test-ws-server] Listening on ws://127.0.0.1:${PORT}`);

wss.on("connection", (ws, req) => {
  const auth = req.headers["authorization"] ?? "(none)";
  console.log(`[test-ws-server] Client connected! Auth: ${auth}`);

  ws.on("message", (data) => {
    const raw = data.toString();

    try {
      const envelope = JSON.parse(raw);
      const { context, action, payload } = envelope;

      switch (action) {
        case "connected":
          console.log(`[test-ws-server] ✅ Plugin connected: ${payload.pluginId || 'unknown'}`);
          console.log(`[test-ws-server] Payload:`, JSON.stringify(payload));
          
          // Send a test message immediately
          const testMsg = {
            context: "test-conv-001",
            action: "msg",
            payload: {
              userId: "test-user-001",
              userName: "测试用户",
              text: "你是什么模型？",
            },
          };
          console.log(`[test-ws-server] 📤 Sending test msg immediately:`, JSON.stringify(testMsg));
          ws.send(JSON.stringify(testMsg));
          break;

        case "ping":
          console.log(`[test-ws-server] 💓 Ping (ts=${payload.ts})`);
          // Optionally reply with pong
          ws.send(JSON.stringify({ context: "", action: "pong", payload: { ts: payload.ts } }));
          break;

        case "typing":
          console.log(`[test-ws-server] ✏️  Agent is typing... (user=${payload.userId})`);
          break;

        case "reply":
          console.log(`[test-ws-server] 🤖 Agent reply (context=${context}):`);
          console.log(`    ${payload.text}`);
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
  });
});
