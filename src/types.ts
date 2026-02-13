// ── HiLight WebSocket Bridge – Type definitions ──────────────────────

/**
 * Unified message envelope.
 * All messages (inbound & outbound) use this structure.
 */
export type HiLightEnvelope<T = unknown> = {
  context: string;   // conversation / session identifier (empty for system messages)
  action: string;    // message type
  payload: T;        // action-specific data
};

// ── Channel config ───────────────────────────────────────────────────

/** Channel configuration stored under `channels["hi-light"]` in openclaw.json */
export type HiLightConfig = {
  enabled?: boolean;
  wsUrl?: string;
  authToken?: string;
  reconnectIntervalMs?: number;
  maxReconnectIntervalMs?: number;
  dmPolicy?: "open" | "pairing" | "allowlist";
  allowFrom?: (string | number)[];
};

/** Resolved account for the hi-light channel */
export type ResolvedHiLightAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  config: HiLightConfig;
  wsUrl?: string;
  authToken?: string;
};

// ── Inbound payloads (服务端 → 插件) ─────────────────────────────────

/** action: "msg" — 服务端发送用户消息给 Agent */
export type MsgPayload = {
  userId: string;
  userName?: string;
  text: string;
};

/** action: "pong" — 服务端心跳回复 */
export type PongPayload = {
  ts: number;
};

// ── Outbound payloads (插件 → 服务端) ────────────────────────────────

/** action: "connected" — 插件连接成功 */
export type ConnectedPayload = {
  pluginId: string;
  accountId: string;
};

/** action: "ping" — 心跳 */
export type PingPayload = {
  ts: number;
};

/** action: "reply" — Agent 完整回复（等 Agent 全部生成后一次性返回） */
export type ReplyPayload = {
  userId: string;
  text: string;
  done: true;
};

/** action: "typing" — Agent 正在思考 */
export type TypingPayload = {
  userId: string;
};

/** action: "error" — 处理失败 */
export type ErrorPayload = {
  userId: string;
  code: string;
  message: string;
};
