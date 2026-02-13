import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { ResolvedHiLightAccount, HiLightConfig } from "./types.js";

const DEFAULT_ACCOUNT_ID = "default";

export function resolveHiLightAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedHiLightAccount {
  const { cfg, accountId } = params;
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const channels = (cfg as Record<string, unknown>).channels as
    | Record<string, unknown>
    | undefined;
  const hlCfg = (channels?.["hi-light"] ?? {}) as HiLightConfig;

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
    authToken,
  };
}

export function listHiLightAccountIds(cfg: OpenClawConfig): string[] {
  const channels = (cfg as Record<string, unknown>).channels as
    | Record<string, unknown>
    | undefined;

  if (!channels?.["hi-light"]) return [];
  return [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultHiLightAccountId(_cfg: OpenClawConfig): string {
  return DEFAULT_ACCOUNT_ID;
}
