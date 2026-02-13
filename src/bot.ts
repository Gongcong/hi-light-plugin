import type { OpenClawConfig, ChannelLogSink } from "openclaw/plugin-sdk";
import type WebSocket from "ws";
import type { HiLightEnvelope, MsgPayload } from "./types.js";
import { createHiLightReplyDispatcher } from "./reply-dispatcher.js";
import { getHiLightRuntime } from "./runtime.js";

export type HandleHiLightMessageParams = {
  ws: WebSocket;
  raw: string;
  config: OpenClawConfig;
  accountId: string;
  log?: ChannelLogSink;
};

/**
 * Handle an incoming message from the external WS server.
 */
export async function handleHiLightMessage(params: HandleHiLightMessageParams): Promise<void> {
  const { ws, raw, config, accountId, log } = params;
  const core = getHiLightRuntime();

  // 1. Parse the envelope
  let envelope: HiLightEnvelope;
  try {
    envelope = JSON.parse(raw) as HiLightEnvelope;
  } catch {
    log?.warn(`hi-light: failed to parse message: ${raw.slice(0, 200)}`);
    return;
  }

  // Ignore non-msg actions (e.g. pong)
  if (envelope.action !== "msg") {
    log?.debug?.(`hi-light: ignoring action: ${envelope.action}`);
    return;
  }

  const payload = envelope.payload as MsgPayload;
  const userId =
    typeof payload.userId === "string" || typeof payload.userId === "number"
      ? String(payload.userId).trim()
      : "";
  const text = typeof payload.text === "string" ? payload.text : "";
  if (!userId || !text.trim()) {
    log?.warn("hi-light: msg payload missing userId or text");
    return;
  }

  const context =
    typeof envelope.context === "string" && envelope.context.trim()
      ? envelope.context.trim()
      : "default";
  const senderName =
    typeof payload.userName === "string" && payload.userName.trim()
      ? payload.userName.trim()
      : userId;

  log?.info(`hi-light: msg from user=${userId} context=${context}`);

  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "hi-light",
    accountId,
    peer: {
      kind: "direct",
      id: userId,
    },
  });

  // 2. Build the inbound context
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
    SenderName: senderName,
  });

  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      log?.error?.(`hi-light: failed to record inbound session: ${String(err)}`);
    },
  });

  // 3. Create reply dispatcher (buffered — waits for full reply)
  const { dispatcher, replyOptions, markDispatchIdle } = createHiLightReplyDispatcher({
    ws,
    config,
    userId,
    context,
    log,
  });

  // 4. Dispatch to OpenClaw core for agent processing
  try {
    await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg: config,
      dispatcher,
      replyOptions,
    });
  } catch (err) {
    log?.error(`hi-light: dispatch error: ${err}`);
    try {
      const errorEnvelope: HiLightEnvelope = {
        context,
        action: "error",
        payload: {
          userId,
          code: "DISPATCH_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      };
      ws.send(JSON.stringify(errorEnvelope));
    } catch {
      // ignore send failures
    }
  } finally {
    markDispatchIdle?.();
  }
}
