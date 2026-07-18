import type { PluginStorage, VendettaPlugin } from "../../vendetta";
import { createRest } from "../../lib/rest";
import { matches } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";

// Everything that touches the host is deferred into onLoad and guarded, so a
// module-load throw can never stop the plugin from enabling, and any real error
// is surfaced as a toast (debug logs aren't readable on this device).

let storage: PluginStorage;
let rest: ReturnType<typeof createRest> | null = null;
let unsubscribe: (() => void) | null = null;

function toast(msg: string) {
  try { vendetta.ui.toasts.showToast(msg); } catch (e) { /* ignore */ }
}

function onMessageCreate(payload: any) {
  try {
    const msg = payload && payload.message;
    if (!msg) return;
    const authorId = msg.author && msg.author.id;
    const channelId = (payload && payload.channelId) || msg.channel_id;
    const ChannelStore = vendetta.metro.findByProps("getChannel", "getDMFromUserId");
    const ch = ChannelStore && ChannelStore.getChannel && ChannelStore.getChannel(channelId);
    const guildId = ch && ch.guild_id;
    if (!guildId) return;
    if (rest && matches(storage.rules, authorId, guildId)) {
      rest.deleteMessage(channelId, msg.id);
    }
  } catch (e) { /* never let one message break the listener */ }
}

const plugin: VendettaPlugin = {
  onLoad() {
    try {
      storage = vendetta.plugin.storage as PluginStorage;
      if (!storage.rules) storage.rules = [];
      rest = createRest(vendetta.logger);
      const FD = vendetta.metro.common.FluxDispatcher;
      FD.subscribe("MESSAGE_CREATE", onMessageCreate);
      unsubscribe = () => FD.unsubscribe("MESSAGE_CREATE", onMessageCreate);
      toast("AutoDelete: enabled");
    } catch (e: any) {
      toast("AutoDelete error: " + (e && e.message ? e.message : String(e)));
    }
  },
  onUnload() {
    try { if (unsubscribe) unsubscribe(); } catch (e) { /* ignore */ }
    try { if (rest) rest.dispose(); } catch (e) { /* ignore */ }
    unsubscribe = null;
  },
  settings: createSettingsList(),
};

export default plugin;
