import type { OpenClawConfig, ChannelLogSink, ReplyPayload } from "openclaw/plugin-sdk";
import type WebSocket from "ws";
import type { HiLightEnvelope, ReplyPayload as HiLightReplyPayload } from "./types.js";
import { getHiLightRuntime } from "./runtime.js";

export type CreateHiLightReplyDispatcherParams = {
  ws: WebSocket;
  config: OpenClawConfig;
  userId: string;
  context: string;
  log?: ChannelLogSink;
};

/**
 * Create a reply dispatcher that **buffers** all agent output
 * and sends a single complete reply back via WebSocket.
 *
 * Instead of streaming chunks, we accumulate text and send
 * one `{ context, action: "reply", payload }` when done.
 */
export function createHiLightReplyDispatcher(params: CreateHiLightReplyDispatcherParams) {
  const { ws, config, userId, context, log } = params;
  const core = getHiLightRuntime();

  // Buffer to accumulate full reply text
  const textChunks: string[] = [];
  let hasSentReply = false;
  let sawFinalPayload = false;

  const flushBufferedReply = (): void => {
    if (hasSentReply) {
      return;
    }
    if (!sawFinalPayload && textChunks.length === 0) {
      return;
    }

    const fullText = textChunks.join("");
    const replyEnvelope: HiLightEnvelope<HiLightReplyPayload> = {
      context,
      action: "reply",
      payload: {
        userId,
        text: fullText,
        done: true,
      },
    };

    try {
      ws.send(JSON.stringify(replyEnvelope));
      hasSentReply = true;
      textChunks.length = 0;
      log?.debug?.(`hi-light: sent buffered reply (len=${fullText.length})`);
    } catch (err) {
      log?.error(`hi-light: failed to send reply: ${err}`);
    }
  };

  const {
    dispatcher,
    replyOptions,
    markDispatchIdle: sdkMarkDispatchIdle,
  } = core.channel.reply.createReplyDispatcherWithTyping({
    humanDelay: core.channel.reply.resolveHumanDelayConfig(config),

    deliver: async (payload: ReplyPayload, info) => {
      const text = payload.text ?? "";
      if (text.length > 0) {
        textChunks.push(text);
      }

      // The SDK signals the final chunk via info.kind === "final"
      const isFinal = info?.kind === "final";

      if (isFinal) {
        sawFinalPayload = true;
        flushBufferedReply();
      } else {
        log?.debug?.(
          `hi-light: buffering chunk (kind=${info?.kind ?? "unknown"}, len=${text.length})`,
        );
      }
    },

    onReplyStart: async () => {
      // Send typing indicator while agent is thinking
      try {
        const typingEnvelope: HiLightEnvelope = {
          context,
          action: "typing",
          payload: { userId },
        };
        ws.send(JSON.stringify(typingEnvelope));
      } catch {
        // ignore
      }
    },
  });

  const markDispatchIdle = () => {
    // Flush only when the whole dispatch has completed.
    flushBufferedReply();
    sdkMarkDispatchIdle();
  };

  return { dispatcher, replyOptions, markDispatchIdle };
}
