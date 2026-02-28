import type { OpenClawConfig, ChannelLogSink } from "openclaw/plugin-sdk";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { PingPayload, ConnectedPayload } from "./types.js";
import { resolveHiLightAccount } from "./accounts.js";
import { handleHiLightMessage } from "./bot.js";
import { sendHiLightEnvelope } from "./ws-send.js";

const WS_UUID_PLACEHOLDER = "{UUIDD}";

/** Close codes that mean auth failure: do not reconnect. */
const AUTH_FAILURE_CLOSE_CODES = new Set([401, 4401, 4001]);

function isAuthFailure(code: number, reason: unknown): boolean {
  if (AUTH_FAILURE_CLOSE_CODES.has(code)) {
    return true;
  }

  let reasonStr = "";
  if (typeof reason === "string") {
    reasonStr = reason;
  } else if (reason && typeof (reason as { toString?: () => string }).toString === "function") {
    reasonStr = (reason as { toString: () => string }).toString() ?? "";
  }

  const lower = reasonStr.toLowerCase();
  return lower.includes("401") || lower.includes("unauthorized");
}

function resolveConnectWsUrl(wsUrl: string): string {
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

export type HiLightMonitorParams = {
  config: OpenClawConfig;
  runtime: unknown;
  abortSignal: AbortSignal;
  accountId: string;
  log?: ChannelLogSink;
};

/**
 * Start the HiLight WebSocket bridge monitor.
 * Connects as a WS Client to the configured external server,
 * handles incoming messages, and reconnects on disconnect.
 */
export async function startHiLightMonitor(params: HiLightMonitorParams): Promise<void> {
  const { config, abortSignal, accountId, log } = params;
  const account = resolveHiLightAccount({ cfg: config, accountId });

  if (!account.wsUrl) {
    log?.error("hi-light: wsUrl is not configured, cannot start monitor");
    return;
  }

  const wsUrlTemplate = account.wsUrl;
  const authToken = account.authToken;
  const baseReconnectMs = account.config.reconnectIntervalMs ?? 3000;
  const maxReconnectMs = account.config.maxReconnectIntervalMs ?? 30000;
  const HEARTBEAT_INTERVAL_MS = 30_000;

  let reconnectAttempts = 0;
  let stopped = false;
  let activeWs: WebSocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let missedPongs = 0;
  const MAX_MISSED_PONGS = 2;
  /** Set when we've received at least one pong; only then do we reset reconnectAttempts on next open. Avoids 401 spinning at 3s. */
  let connectionValidated = false;
  let stopResolved = false;
  let resolveStopped!: () => void;
  const stoppedPromise = new Promise<void>((resolve) => {
    resolveStopped = resolve;
  });

  function clearHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function clearReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function resolveStoppedOnce(): void {
    if (stopResolved) {
      return;
    }
    stopResolved = true;
    resolveStopped();
  }

  function stopAndDispose(reason: string): void {
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
        // ignore termination failures
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

  function connect(): void {
    if (stopped || abortSignal.aborted) {
      return;
    }

    const headers: Record<string, string> = {};
    if (authToken) {
      headers["Authorization"] = `${authToken}`;
    }

    const connectWsUrl = resolveConnectWsUrl(wsUrlTemplate);

    log?.info(`hi-light: connecting to ${connectWsUrl} (attempt ${reconnectAttempts + 1})`);

    /** Set in error handler when upgrade fails with 401; close handler will then stop reconnecting. */
    let authFailureFromError = false;

    const ws = new WebSocket(connectWsUrl, { headers });
    activeWs = ws;

    ws.on("open", () => {
      if (stopped || abortSignal.aborted) {
        try {
          ws.terminate();
        } catch {
          // ignore termination failures
        }
        return;
      }
      // Only reset backoff after we receive a pong (connection validated). Otherwise e.g. 401 would reset every time and we'd retry every 3s.
      connectionValidated = false;
      log?.info(`hi-light: connected to ${connectWsUrl}`);

      // Send connected status
      sendHiLightEnvelope<ConnectedPayload>({
        ws,
        log,
        tag: "connected",
        envelope: {
          context: "",
          action: "connected",
          payload: { pluginId: "hi-light", accountId },
        },
      });

      // Start heartbeat — send JSON ping every 30s, detect pong timeout
      clearHeartbeat();
      missedPongs = 0;
      heartbeatTimer = setInterval(() => {
        // Check if previous pong was received
        if (missedPongs >= MAX_MISSED_PONGS) {
          log?.warn(
            `hi-light: missed ${missedPongs} pongs, connection seems dead. Reconnecting...`,
          );
          clearHeartbeat();
          ws.close(4000, "pong timeout");
          return;
        }

        missedPongs++;
        sendHiLightEnvelope<PingPayload>({
          ws,
          log,
          tag: `heartbeat-${missedPongs}`,
          envelope: {
            context: "",
            action: "ping",
            payload: { ts: Date.now() },
          },
        });
      }, HEARTBEAT_INTERVAL_MS);
    });

    ws.on("message", (data: WebSocket.RawData) => {
      if (stopped) {
        return;
      }
      const raw = data.toString();
      log?.debug?.(`hi-light: received raw msg len=${raw.length} raw=${raw}`);

      // Handle pong directly — reset missed counter
      try {
        const envelope = JSON.parse(raw) as { action?: unknown };
        if (envelope.action === "pong") {
          missedPongs = 0;
          connectionValidated = true;
          reconnectAttempts = 0;
          log?.debug?.("hi-light: pong received, connection healthy");
          return;
        }
      } catch {
        // Not JSON, let bot handle it
      }

      handleHiLightMessage({
        ws,
        raw,
        config,
        accountId,
        log,
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
      const authFailed = authFailureFromError || isAuthFailure(code, reason);
      if (authFailed) {
        log?.error(
          `hi-light: auth failed (code=${code}, reason=${reasonStr}), stop reconnecting. Check token in openclaw.json.`
        );
        stopAndDispose("auth failed (401), stop reconnecting");
        return;
      }
      log?.warn(`hi-light: closed (code=${code}, reason=${reasonStr}), reconnecting...`);
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      const msg = err.message || "";
      if (/401|unauthorized/i.test(msg)) {
        authFailureFromError = true;
      }
      log?.error(`hi-light: connection error: ${err.message}`);
    });
  }

  function scheduleReconnect(): void {
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
