var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/accounts.ts
function resolveHiLightAccount(params) {
  const { cfg, accountId } = params;
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const channels = cfg.channels;
  const hlCfg = channels?.["hi-light"] ?? {};
  const wsUrl = hlCfg.wsUrl;
  const authToken = hlCfg.authToken;
  const configured = !!wsUrl;
  const enabled = hlCfg.enabled !== false;
  return {
    accountId: id,
    enabled,
    configured,
    config: hlCfg,
    wsUrl,
    authToken
  };
}
function listHiLightAccountIds(cfg) {
  const channels = cfg.channels;
  if (!channels?.["hi-light"]) return [];
  return [DEFAULT_ACCOUNT_ID];
}
function resolveDefaultHiLightAccountId(_cfg) {
  return DEFAULT_ACCOUNT_ID;
}
var DEFAULT_ACCOUNT_ID;
var init_accounts = __esm({
  "src/accounts.ts"() {
    DEFAULT_ACCOUNT_ID = "default";
  }
});

// src/send.ts
var send_exports = {};
__export(send_exports, {
  sendHiLightText: () => sendHiLightText
});
async function sendHiLightText(ctx) {
  console.warn(
    `hi-light: outbound send to=${ctx.to} is not fully supported yet. Use inbound message flow instead.`
  );
  return {
    ok: false,
    error: new Error("hi-light outbound send not yet implemented")
  };
}
var init_send = __esm({
  "src/send.ts"() {
  }
});

// src/runtime.ts
function setHiLightRuntime(next) {
  runtime = next;
}
function getHiLightRuntime() {
  if (!runtime) {
    throw new Error("HiLight runtime not initialized");
  }
  return runtime;
}
var runtime;
var init_runtime = __esm({
  "src/runtime.ts"() {
    runtime = null;
  }
});

// src/ws-send.ts
import WebSocket from "ws";
function sendHiLightEnvelope(params) {
  const { ws, envelope, log, tag } = params;
  const label = tag ? `${tag}` : envelope.action;
  const raw = JSON.stringify(envelope);
  const isHeartbeatAction = envelope.action === "ping" || envelope.action === "pong";
  if (!isHeartbeatAction) {
    log?.debug?.(`hi-light: ws send start action=${envelope.action} tag=${label} payload=${raw}`);
  }
  if (typeof ws.readyState === "number" && ws.readyState !== WebSocket.OPEN) {
    if (!isHeartbeatAction) {
      log?.warn(
        `hi-light: ws send skipped (socket not open) action=${envelope.action} tag=${label} readyState=${ws.readyState} payload=${raw}`
      );
    }
    return false;
  }
  try {
    ws.send(raw, (err) => {
      if (err) {
        if (!isHeartbeatAction) {
          log?.error(
            `hi-light: ws send failed action=${envelope.action} tag=${label} error=${err.message} payload=${raw}`
          );
        }
        return;
      }
      if (!isHeartbeatAction) {
        log?.debug?.(`hi-light: ws send success action=${envelope.action} tag=${label}`);
      }
    });
    return true;
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    if (!isHeartbeatAction) {
      log?.error(
        `hi-light: ws send failed action=${envelope.action} tag=${label} error=${errorText} payload=${raw}`
      );
    }
    return false;
  }
}
var init_ws_send = __esm({
  "src/ws-send.ts"() {
  }
});

// src/reply-dispatcher.ts
function createHiLightReplyDispatcher(params) {
  const { ws, config, userId, context, log } = params;
  const core = getHiLightRuntime();
  const stringifyRaw = (value) => {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  };
  const textChunks = [];
  let hasSentReply = false;
  let sawFinalPayload = false;
  let streamSeq = 0;
  const flushBufferedReply = () => {
    if (hasSentReply) {
      return;
    }
    if (!sawFinalPayload && textChunks.length === 0) {
      return;
    }
    const fullText = textChunks.join("");
    const replyEnvelope = {
      context,
      action: "reply",
      payload: {
        userId,
        text: fullText,
        done: true
      }
    };
    if (sendHiLightEnvelope({ ws, envelope: replyEnvelope, log, tag: "buffered-reply" })) {
      hasSentReply = true;
      textChunks.length = 0;
      log?.debug?.(`hi-light: sent buffered reply (len=${fullText.length})`);
    }
  };
  const {
    dispatcher,
    replyOptions,
    markDispatchIdle: sdkMarkDispatchIdle
  } = core.channel.reply.createReplyDispatcherWithTyping({
    humanDelay: core.channel.reply.resolveHumanDelayConfig(config),
    deliver: async (payload, info) => {
      const text = payload.text ?? "";
      const kind = info?.kind ?? "unknown";
      streamSeq += 1;
      log?.debug?.(
        `hi-light: openclaw stream chunk seq=${streamSeq} kind=${kind} textLen=${text.length} raw=${stringifyRaw({ payload, info })}`
      );
      if (text.length > 0) {
        textChunks.push(text);
      }
      const isFinal = kind === "final";
      if (isFinal) {
        sawFinalPayload = true;
        flushBufferedReply();
      } else {
        log?.debug?.(
          `hi-light: buffering chunk (kind=${info?.kind ?? "unknown"}, len=${text.length})`
        );
      }
    },
    onReplyStart: async () => {
      const typingEnvelope = {
        context,
        action: "typing",
        payload: { userId }
      };
      sendHiLightEnvelope({ ws, envelope: typingEnvelope, log, tag: "typing" });
    }
  });
  const markDispatchIdle = () => {
    flushBufferedReply();
    sdkMarkDispatchIdle();
  };
  return { dispatcher, replyOptions, markDispatchIdle };
}
var init_reply_dispatcher = __esm({
  "src/reply-dispatcher.ts"() {
    init_runtime();
    init_ws_send();
  }
});

// src/bot.ts
async function handleHiLightMessage(params) {
  const { ws, raw, config, accountId, log } = params;
  const core = getHiLightRuntime();
  const stringifyRaw = (value) => {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  };
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    log?.warn(`hi-light: failed to parse message: ${raw.slice(0, 200)}`);
    return;
  }
  if (envelope.action !== "msg") {
    log?.debug?.(`hi-light: ignoring action: ${envelope.action}`);
    return;
  }
  const payload = envelope.payload;
  const userId = typeof payload.userId === "string" || typeof payload.userId === "number" ? String(payload.userId).trim() : "";
  const text = typeof payload.text === "string" ? payload.text : "";
  if (!userId || !text.trim()) {
    log?.warn("hi-light: msg payload missing userId or text");
    return;
  }
  const context = typeof envelope.context === "string" && envelope.context.trim() ? envelope.context.trim() : "default";
  const senderName = typeof payload.userName === "string" && payload.userName.trim() ? payload.userName.trim() : userId;
  log?.info(`hi-light: msg from user=${userId} context=${context}`);
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "hi-light",
    accountId,
    peer: {
      kind: "direct",
      id: userId
    }
  });
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: text,
    BodyForAgent: text,
    From: userId,
    To: "hi-light",
    Provider: "hi-light",
    AccountId: route.accountId,
    ChatType: "direct",
    SessionKey: route.sessionKey,
    IsGroupchat: false,
    SenderName: senderName
  });
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId
  });
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      log?.error?.(`hi-light: failed to record inbound session: ${String(err)}`);
    }
  });
  const { dispatcher, replyOptions, markDispatchIdle } = createHiLightReplyDispatcher({
    ws,
    config,
    userId,
    context,
    log
  });
  try {
    log?.debug?.(`hi-light: openclaw inbound ctx raw=${stringifyRaw(ctxPayload)}`);
    await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg: config,
      dispatcher,
      replyOptions
    });
  } catch (err) {
    log?.error(`hi-light: dispatch error: ${err}`);
    const dispatchErrorRaw = err instanceof Error ? {
      name: err.name,
      message: err.message,
      stack: err.stack
    } : err;
    log?.error(`hi-light: openclaw dispatch error raw=${JSON.stringify(dispatchErrorRaw)}`);
    const errorEnvelope = {
      context,
      action: "error",
      payload: {
        userId,
        code: "DISPATCH_FAILED",
        message: err instanceof Error ? err.message : String(err)
      }
    };
    sendHiLightEnvelope({ ws, envelope: errorEnvelope, log, tag: "dispatch-error" });
  } finally {
    markDispatchIdle?.();
  }
}
var init_bot = __esm({
  "src/bot.ts"() {
    init_reply_dispatcher();
    init_runtime();
    init_ws_send();
  }
});

// src/monitor.ts
var monitor_exports = {};
__export(monitor_exports, {
  startHiLightMonitor: () => startHiLightMonitor
});
import { randomUUID } from "node:crypto";
import WebSocket2 from "ws";
function resolveConnectWsUrl(wsUrl) {
  const uuid = randomUUID();
  if (wsUrl.includes(WS_UUID_PLACEHOLDER)) {
    return wsUrl.replace(WS_UUID_PLACEHOLDER, uuid);
  }
  try {
    const parsed = new URL(wsUrl);
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/${uuid}`;
    return parsed.toString();
  } catch {
    const trimmed = wsUrl.replace(/\/+$/, "");
    return `${trimmed}/${uuid}`;
  }
}
async function startHiLightMonitor(params) {
  const { config, abortSignal, accountId, log } = params;
  const account = resolveHiLightAccount({ cfg: config, accountId });
  if (!account.wsUrl) {
    log?.error("hi-light: wsUrl is not configured, cannot start monitor");
    return;
  }
  const wsUrlTemplate = account.wsUrl;
  const authToken = account.authToken;
  const baseReconnectMs = account.config.reconnectIntervalMs ?? 3e3;
  const maxReconnectMs = account.config.maxReconnectIntervalMs ?? 3e4;
  const HEARTBEAT_INTERVAL_MS = 3e4;
  let reconnectAttempts = 0;
  let stopped = false;
  let activeWs = null;
  let heartbeatTimer = null;
  let reconnectTimer = null;
  let missedPongs = 0;
  const MAX_MISSED_PONGS = 2;
  let stopResolved = false;
  let resolveStopped;
  const stoppedPromise = new Promise((resolve) => {
    resolveStopped = resolve;
  });
  function clearHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }
  function clearReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
  function resolveStoppedOnce() {
    if (stopResolved) {
      return;
    }
    stopResolved = true;
    resolveStopped();
  }
  function stopAndDispose(reason) {
    if (stopped) {
      return;
    }
    stopped = true;
    clearHeartbeat();
    clearReconnect();
    if (activeWs) {
      log?.info(`hi-light: stopping monitor (${reason}), closing WS connection`);
      try {
        activeWs.terminate();
      } catch {
      }
      activeWs = null;
    }
    resolveStoppedOnce();
  }
  const onAbort = () => {
    stopAndDispose("gateway shutdown");
  };
  if (abortSignal.aborted) {
    stopAndDispose("already aborted");
    await stoppedPromise;
    return;
  }
  abortSignal.addEventListener("abort", onAbort, { once: true });
  function connect() {
    if (stopped || abortSignal.aborted) {
      return;
    }
    const headers = {};
    if (authToken) {
      headers["Authorization"] = `${authToken}`;
    }
    const connectWsUrl = resolveConnectWsUrl(wsUrlTemplate);
    log?.info(`hi-light: connecting to ${connectWsUrl} (attempt ${reconnectAttempts + 1})`);
    const ws = new WebSocket2(connectWsUrl, { headers });
    activeWs = ws;
    ws.on("open", () => {
      if (stopped || abortSignal.aborted) {
        try {
          ws.terminate();
        } catch {
        }
        return;
      }
      reconnectAttempts = 0;
      log?.info(`hi-light: connected to ${connectWsUrl}`);
      sendHiLightEnvelope({
        ws,
        log,
        tag: "connected",
        envelope: {
          context: "",
          action: "connected",
          payload: { pluginId: "hi-light", accountId }
        }
      });
      clearHeartbeat();
      missedPongs = 0;
      heartbeatTimer = setInterval(() => {
        if (missedPongs >= MAX_MISSED_PONGS) {
          log?.warn(
            `hi-light: missed ${missedPongs} pongs, connection seems dead. Reconnecting...`
          );
          clearHeartbeat();
          ws.close(4e3, "pong timeout");
          return;
        }
        missedPongs++;
        sendHiLightEnvelope({
          ws,
          log,
          tag: `heartbeat-${missedPongs}`,
          envelope: {
            context: "",
            action: "ping",
            payload: { ts: Date.now() }
          }
        });
      }, HEARTBEAT_INTERVAL_MS);
    });
    ws.on("message", (data) => {
      if (stopped) {
        return;
      }
      const raw = data.toString();
      try {
        const envelope = JSON.parse(raw);
        if (envelope.action === "pong") {
          missedPongs = 0;
          return;
        }
      } catch {
      }
      log?.debug?.(`hi-light: received raw msg len=${raw.length} raw=${raw}`);
      handleHiLightMessage({
        ws,
        raw,
        config,
        accountId,
        log
      }).catch((err) => {
        log?.error(`hi-light: error handling message: ${err}`);
      });
    });
    ws.on("close", (code, reason) => {
      clearHeartbeat();
      if (activeWs === ws) {
        activeWs = null;
      }
      if (stopped || abortSignal.aborted) {
        log?.info("hi-light: connection closed (gateway stopped)");
        resolveStoppedOnce();
        return;
      }
      const reasonStr = reason?.toString() || "unknown";
      log?.warn(`hi-light: closed (code=${code}, reason=${reasonStr}), reconnecting...`);
      scheduleReconnect();
    });
    ws.on("error", (err) => {
      log?.error(`hi-light: connection error: ${err.message}`);
    });
  }
  function scheduleReconnect() {
    if (stopped || abortSignal.aborted) {
      return;
    }
    reconnectAttempts++;
    const delay = Math.min(baseReconnectMs * Math.pow(2, reconnectAttempts - 1), maxReconnectMs);
    log?.info(`hi-light: reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    clearReconnect();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }
  connect();
  try {
    await stoppedPromise;
  } finally {
    abortSignal.removeEventListener("abort", onAbort);
    clearHeartbeat();
    clearReconnect();
  }
}
var WS_UUID_PLACEHOLDER;
var init_monitor = __esm({
  "src/monitor.ts"() {
    init_accounts();
    init_bot();
    init_ws_send();
    WS_UUID_PLACEHOLDER = "{UUIDD}";
  }
});

// index.ts
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// src/channel.ts
init_accounts();
import { DEFAULT_ACCOUNT_ID as DEFAULT_ACCOUNT_ID2 } from "openclaw/plugin-sdk";
var meta = {
  id: "hi-light",
  label: "HiLight",
  selectionLabel: "HiLight WebSocket Bridge",
  docsPath: "/channels/hi-light",
  docsLabel: "hi-light",
  blurb: "HiLight \u2014 WebSocket bridge channel, connects to an external WS server.",
  order: 80
};
var hiLightPlugin = {
  id: "hi-light",
  meta: { ...meta },
  capabilities: {
    chatTypes: ["direct"]
  },
  reload: { configPrefixes: ["channels.hi-light"] },
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        wsUrl: { type: "string", format: "uri" },
        authToken: { type: "string" },
        reconnectIntervalMs: { type: "integer", minimum: 1e3 },
        maxReconnectIntervalMs: { type: "integer", minimum: 1e3 },
        dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist"] },
        allowFrom: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] }
        }
      }
    },
    uiHints: {
      wsUrl: {
        label: "WebSocket URL",
        help: "Base WebSocket URL. Plugin appends a new UUID path segment on every connection.",
        placeholder: "wss://host/path"
      },
      authToken: {
        label: "Auth Token",
        help: "Token sent as-is in the Authorization header during WS handshake",
        sensitive: true
      },
      reconnectIntervalMs: {
        label: "Reconnect Interval (ms)",
        help: "Base interval for reconnection attempts (exponential backoff)",
        advanced: true
      },
      maxReconnectIntervalMs: {
        label: "Max Reconnect Interval (ms)",
        help: "Maximum interval between reconnection attempts",
        advanced: true
      }
    }
  },
  // ── Config Adapter ──────────────────────────────────────────────────────
  config: {
    listAccountIds: (cfg) => listHiLightAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveHiLightAccount({ cfg, accountId }),
    defaultAccountId: (_cfg) => resolveDefaultHiLightAccountId(_cfg),
    isEnabled: (account) => account.enabled,
    isConfigured: (account) => account.configured,
    unconfiguredReason: () => "wsUrl is not set in channels.hi-light config",
    resolveAllowFrom: ({ cfg }) => {
      const hlCfg = resolveHiLightAccount({ cfg }).config;
      return hlCfg.allowFrom;
    },
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      wsUrl: account.wsUrl
    }),
    setAccountEnabled: ({ cfg, enabled }) => {
      const channels = cfg.channels;
      const hlCfg = channels?.["hi-light"] ?? {};
      return {
        ...cfg,
        channels: {
          ...channels,
          "hi-light": {
            ...hlCfg,
            enabled
          }
        }
      };
    },
    applyAccountConfig: ({ cfg, input }) => {
      const channels = cfg.channels;
      const hlCfg = channels?.["hi-light"] ?? {};
      return {
        ...cfg,
        channels: {
          ...channels,
          "hi-light": {
            ...hlCfg,
            ...input.url ? { wsUrl: input.url } : {},
            ...input.token ? { authToken: input.token } : {},
            enabled: true
          }
        }
      };
    }
  },
  // ── Security ────────────────────────────────────────────────────────────
  security: {
    resolveDmPolicy: ({ account, cfg }) => {
      const hlCfg = account.config;
      const policy = hlCfg.dmPolicy ?? "open";
      return {
        policy,
        allowFrom: hlCfg.allowFrom ?? null,
        allowFromPath: 'channels["hi-light"].allowFrom',
        policyPath: 'channels["hi-light"].dmPolicy',
        approveHint: "openclaw allow hi-light <userId>"
      };
    }
  },
  // ── Status ──────────────────────────────────────────────────────────────
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID2,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      wsUrl: snapshot.wsUrl ?? null,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null
    }),
    buildAccountSnapshot: ({ account, runtime: runtime2 }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      wsUrl: account.wsUrl,
      running: runtime2?.running ?? false,
      lastStartAt: runtime2?.lastStartAt ?? null,
      lastStopAt: runtime2?.lastStopAt ?? null,
      lastError: runtime2?.lastError ?? null
    })
  },
  // ── Outbound ────────────────────────────────────────────────────────────
  outbound: {
    deliveryMode: "direct",
    sendText: async (ctx) => {
      const { sendHiLightText: sendHiLightText2 } = await Promise.resolve().then(() => (init_send(), send_exports));
      return sendHiLightText2(ctx);
    }
  },
  // ── Gateway ─────────────────────────────────────────────────────────────
  gateway: {
    startAccount: async (ctx) => {
      const { startHiLightMonitor: startHiLightMonitor2 } = await Promise.resolve().then(() => (init_monitor(), monitor_exports));
      const account = resolveHiLightAccount({
        cfg: ctx.cfg,
        accountId: ctx.accountId
      });
      ctx.setStatus({ accountId: ctx.accountId });
      ctx.log?.info(`hi-light: starting [${ctx.accountId}] \u2192 ${account.wsUrl ?? "(no url)"}`);
      return startHiLightMonitor2({
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: ctx.accountId,
        log: ctx.log
      });
    }
  }
};

// index.ts
init_runtime();
var plugin = {
  id: "hi-light",
  name: "HiLight",
  description: "HiLight WebSocket bridge channel plugin \u2014 connects to external WS server",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setHiLightRuntime(api.runtime);
    api.registerChannel({ plugin: hiLightPlugin });
  }
};
var index_default = plugin;
export {
  index_default as default,
  hiLightPlugin
};
