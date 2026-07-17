import type { PluginStorage } from "../../bunny";
import { createRest } from "../../lib/rest";
import { matches } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";

const storage = bunny.plugin.createStorage<PluginStorage>();
storage.rules ??= [];

const logger = bunny.plugin.logger;
const { FluxDispatcher } = bunny.metro.common;
const rest = createRest(logger);

function onMessageCreate(payload: any) {
  const msg = payload?.message;
  if (!msg) return;
  const authorId = msg.author?.id;
  const guildId = msg.guild_id ?? payload.guildId;
  if (!guildId) return; // DMs have no guild_id
  if (matches(storage.rules, authorId, guildId)) {
    rest.deleteMessage(msg.channel_id, msg.id);
  }
}

export default definePlugin({
  start() {
    FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    logger.log("[AutoDelete] started");
  },
  stop() {
    FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
    rest.dispose();
    logger.log("[AutoDelete] stopped");
  },
  SettingsComponent: createSettingsList(storage),
});
