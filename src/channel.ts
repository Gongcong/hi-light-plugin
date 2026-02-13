import type { ChannelMeta, ChannelPlugin } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { ResolvedHiLightAccount, HiLightConfig } from "./types.js";
import {
  resolveHiLightAccount,
  listHiLightAccountIds,
  resolveDefaultHiLightAccountId,
} from "./accounts.js";

const meta: ChannelMeta = {
  id: "hi-light",
  label: "HiLight",
  selectionLabel: "HiLight WebSocket Bridge",
  docsPath: "/channels/hi-light",
  docsLabel: "hi-light",
  blurb: "HiLight — WebSocket bridge channel, connects to an external WS server.",
  order: 80,
};

export const hiLightPlugin: ChannelPlugin<ResolvedHiLightAccount> = {
  id: "hi-light",
  meta: { ...meta },

  capabilities: {
    chatTypes: ["direct"],
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
        reconnectIntervalMs: { type: "integer", minimum: 1000 },
        maxReconnectIntervalMs: { type: "integer", minimum: 1000 },
        dmPolicy: { type: "string", enum: ["open", "pairing", "allowlist"] },
        allowFrom: {
          type: "array",
          items: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
      },
    },
    uiHints: {
      wsUrl: {
        label: "WebSocket URL",
        help: "Base WebSocket URL. Plugin appends a new UUID path segment on every connection.",
        placeholder: "wss://host/path",
      },
      authToken: {
        label: "Auth Token",
        help: "Token sent as-is in the Authorization header during WS handshake",
        sensitive: true,
      },
      reconnectIntervalMs: {
        label: "Reconnect Interval (ms)",
        help: "Base interval for reconnection attempts (exponential backoff)",
        advanced: true,
      },
      maxReconnectIntervalMs: {
        label: "Max Reconnect Interval (ms)",
        help: "Maximum interval between reconnection attempts",
        advanced: true,
      },
    },
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
      wsUrl: account.wsUrl,
    }),

    setAccountEnabled: ({ cfg, enabled }) => {
      const channels = (cfg as Record<string, unknown>).channels as
        | Record<string, unknown>
        | undefined;
      const hlCfg = (channels?.["hi-light"] ?? {}) as HiLightConfig;
      return {
        ...cfg,
        channels: {
          ...channels,
          "hi-light": {
            ...hlCfg,
            enabled,
          },
        },
      };
    },

    applyAccountConfig: ({ cfg, input }) => {
      const channels = (cfg as Record<string, unknown>).channels as
        | Record<string, unknown>
        | undefined;
      const hlCfg = (channels?.["hi-light"] ?? {}) as HiLightConfig;
      return {
        ...cfg,
        channels: {
          ...channels,
          "hi-light": {
            ...hlCfg,
            ...(input.url ? { wsUrl: input.url } : {}),
            ...(input.token ? { authToken: input.token } : {}),
            enabled: true,
          },
        },
      };
    },
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
        approveHint: "openclaw allow hi-light <userId>",
      };
    },
  },

  // ── Status ──────────────────────────────────────────────────────────────
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      wsUrl: snapshot.wsUrl ?? null,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      wsUrl: account.wsUrl,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
    }),
  },

  // ── Outbound ────────────────────────────────────────────────────────────
  outbound: {
    deliveryMode: "direct",
    sendText: async (ctx) => {
      const { sendHiLightText } = await import("./send.js");
      return sendHiLightText(ctx);
    },
  },

  // ── Gateway ─────────────────────────────────────────────────────────────
  gateway: {
    startAccount: async (ctx) => {
      const { startHiLightMonitor } = await import("./monitor.js");
      const account = resolveHiLightAccount({
        cfg: ctx.cfg,
        accountId: ctx.accountId,
      });
      ctx.setStatus({ accountId: ctx.accountId });
      ctx.log?.info(`hi-light: starting [${ctx.accountId}] → ${account.wsUrl ?? "(no url)"}`);
      return startHiLightMonitor({
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: ctx.accountId,
        log: ctx.log,
      });
    },
  },
};
