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

function onMemberAdd(payload: any) {
  try {
    const guildId = (payload && payload.guildId) || (payload && payload.guild_id);
    const userId =
      (payload && payload.user && payload.user.id) ||
      (payload && payload.member && payload.member.user && payload.member.user.id);
    if (rest && matches(storage.rules, userId, guildId)) {
      rest.kickMember(guildId, userId);
    }
  } catch (e) { /* never let one event break the listener */ }
}

function sweep() {
  // Attempt a kick for every rule; users not present return 404 (ignored).
  const rules = storage.rules || [];
  for (let i = 0; i < rules.length; i++) {
    if (rest) rest.kickMember(rules[i].guildId, rules[i].userId);
  }
}

const plugin: VendettaPlugin = {
  onLoad() {
    try {
      storage = vendetta.plugin.storage as PluginStorage;
      if (!storage.rules) storage.rules = [];
      rest = createRest(vendetta.logger);
      sweep();
      const FD = vendetta.metro.common.FluxDispatcher;
      FD.subscribe("GUILD_MEMBER_ADD", onMemberAdd);
      unsubscribe = () => FD.unsubscribe("GUILD_MEMBER_ADD", onMemberAdd);
      toast("AutoKick: enabled (" + (storage.rules.length) + " rule(s))");
    } catch (e: any) {
      toast("AutoKick error: " + (e && e.message ? e.message : String(e)));
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
