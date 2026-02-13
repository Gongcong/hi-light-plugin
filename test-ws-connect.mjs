#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const WS_TEMPLATE =
  process.env.HI_LIGHT_WS_TEMPLATE ??
  "wss://test-api.guangfan-ai.online/open-apis/device-agent/v1/websocket/{UUIDD}";
const UUID_PLACEHOLDER = "{UUIDD}";
const TOKEN =
  process.env.HI_LIGHT_TOKEN ??
  "eyJhbGciOiJIUzM4NCJ9.eyJ1aWQiOiIwNTg1OTExIiwicHZkIjoiZGV2aWNlX2FnZW50IiwiZXhwIjoxNzcyNzAxNjQwfQ.yDKAiAqnss7sNKqf4CmRCjsIaNanawG7ubvtjo7fitOIbGQoVVFW9GsWG8HEMG-I";
const TIMEOUT_MS = Number(process.env.HI_LIGHT_TIMEOUT_MS ?? "12000");

const wsUrl = WS_TEMPLATE.includes(UUID_PLACEHOLDER)
  ? WS_TEMPLATE.replace(UUID_PLACEHOLDER, randomUUID())
  : WS_TEMPLATE;

console.log(`[ws-probe] connecting to: ${wsUrl}`);
console.log(`[ws-probe] timeout: ${TIMEOUT_MS}ms`);

let finished = false;
let timeoutTimer = null;
const ws = new WebSocket(wsUrl, {
  headers: {
    Authorization: TOKEN,
  },
});

function finish(code) {
  if (finished) return;
  finished = true;
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
  try {
    ws.terminate();
  } catch {
    // ignore termination errors
  }
  process.exitCode = code;
}

timeoutTimer = setTimeout(() => {
  console.error(`[ws-probe] timeout after ${TIMEOUT_MS}ms`);
  finish(1);
}, TIMEOUT_MS);

ws.on("open", () => {
  console.log("[ws-probe] handshake success (connected)");
  ws.close(1000, "probe done");
});

ws.on("close", (code, reason) => {
  const reasonText = reason?.toString() || "(none)";
  console.log(`[ws-probe] closed: code=${code} reason=${reasonText}`);
  finish(code === 1000 ? 0 : 1);
});

ws.on("error", (err) => {
  console.error(`[ws-probe] handshake failed: ${err.message}`);
  finish(1);
});
