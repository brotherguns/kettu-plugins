import type { PluginStorage, VendettaPlugin } from "../../vendetta";
import { createRest } from "../../lib/rest";
import { matches } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";

const storage = vendetta.plugin.storage as PluginStorage;
storage.rules ??= [];

const logger = vendetta.logger;
const { FluxDispatcher } = vendetta.metro.common;
const rest = createRest(logger);

function onMemberAdd(payload: any) {
  const guildId = payload?.guildId ?? payload?.guild_id;
  const userId = payload?.user?.id ?? payload?.member?.user?.id;
  if (matches(storage.rules, userId, guildId)) {
    rest.kickMember(guildId, userId);
  }
}

function sweep() {
  // Attempt a kick for every rule; users not present return 404 (ignored).
  for (const rule of storage.rules) {
    rest.kickMember(rule.guildId, rule.userId);
  }
  logger.log(`[AutoKick] sweep queued ${storage.rules.length} rule(s)`);
}

const plugin: VendettaPlugin = {
  onLoad() {
    sweep();
    FluxDispatcher.subscribe("GUILD_MEMBER_ADD", onMemberAdd);
    logger.log("[AutoKick] loaded");
  },
  onUnload() {
    FluxDispatcher.unsubscribe("GUILD_MEMBER_ADD", onMemberAdd);
    rest.dispose();
    logger.log("[AutoKick] unloaded");
  },
  settings: createSettingsList(storage),
};

export default plugin;
