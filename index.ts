import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/plugin-entry";
import { hiLightPlugin } from "./src/channel.js";
import { setHiLightRuntime } from "./src/runtime.js";

export { hiLightPlugin } from "./src/channel.js";

const plugin = {
  id: "hi-light",
  name: "HiLight",
  description: "HiLight WebSocket bridge channel plugin — connects to external WS server",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setHiLightRuntime(api.runtime);
    api.registerChannel({ plugin: hiLightPlugin });
  },
};

export default plugin;
