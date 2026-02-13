import type { ChannelOutboundContext } from "openclaw/plugin-sdk";
import type { OutboundDeliveryResult } from "openclaw/plugin-sdk";

/**
 * Send a text message via the HiLight outbound adapter.
 */
export async function sendHiLightText(
  ctx: ChannelOutboundContext,
): Promise<OutboundDeliveryResult> {
  console.warn(
    `hi-light: outbound send to=${ctx.to} is not fully supported yet. ` +
      `Use inbound message flow instead.`,
  );

  return {
    ok: false,
    error: new Error("hi-light outbound send not yet implemented"),
  };
}
