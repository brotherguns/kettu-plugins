import type { PluginStorage } from "../../bunny";
import { createRest } from "../../lib/rest";
import { matches } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";

const storage = bunny.plugin.createStorage<PluginStorage>();
storage.rules ??= [];

const logger = bunny.plugin.logger;
const { FluxDispatcher } = bunny.metro.common;
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

export default definePlugin({
  start() {
    sweep();
    FluxDispatcher.subscribe("GUILD_MEMBER_ADD", onMemberAdd);
    logger.log("[AutoKick] started");
  },
  stop() {
    FluxDispatcher.unsubscribe("GUILD_MEMBER_ADD", onMemberAdd);
    rest.dispose();
    logger.log("[AutoKick] stopped");
  },
  SettingsComponent: createSettingsList(storage),
});
