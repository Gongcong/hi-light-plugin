import type { ChannelLogSink } from "openclaw/plugin-sdk";
import WebSocket from "ws";
import type { HiLightEnvelope } from "./types.js";

export type SendHiLightEnvelopeParams<T> = {
  ws: WebSocket;
  envelope: HiLightEnvelope<T>;
  log?: ChannelLogSink;
  tag?: string;
};

/**
 * Send an envelope through WebSocket and log full payload + send result.
 * Note: send callback reports local send queue result, not remote business ack.
 */
export function sendHiLightEnvelope<T>(params: SendHiLightEnvelopeParams<T>): boolean {
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
        `hi-light: ws send skipped (socket not open) action=${envelope.action} tag=${label} readyState=${ws.readyState} payload=${raw}`,
      );
    }
    return false;
  }

  try {
    ws.send(raw, (err?: Error) => {
      if (err) {
        if (!isHeartbeatAction) {
          log?.error(
            `hi-light: ws send failed action=${envelope.action} tag=${label} error=${err.message} payload=${raw}`,
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
        `hi-light: ws send failed action=${envelope.action} tag=${label} error=${errorText} payload=${raw}`,
      );
    }
    return false;
  }
}
