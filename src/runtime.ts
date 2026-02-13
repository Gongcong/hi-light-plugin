import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setHiLightRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getHiLightRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("HiLight runtime not initialized");
  }
  return runtime;
}
