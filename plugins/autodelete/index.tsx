import type { PluginStorage } from "../../bunny";
import { createRest } from "../../lib/rest";
import { matches } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";

const storage = bunny.plugin.createStorage<PluginStorage>();
storage.rules ??= [];

const logger = bunny.plugin.logger;
const { FluxDispatcher } = bunny.metro.common;
const ChannelStore = bunny.metro.findByProps("getChannel", "getDMFromUserId");
const rest = createRest(logger);

function onMessageCreate(payload: any) {
  const msg = payload?.message;
  if (!msg) return;
  const authorId = msg.author?.id;
  // MESSAGE_CREATE carries no guild id (on the payload or the message); it must
  // be resolved from the channel. channelId is on the payload; fall back to the
  // message's own channel_id.
  const channelId = payload.channelId ?? msg.channel_id;
  const guildId = ChannelStore?.getChannel?.(channelId)?.guild_id;
  if (!guildId) return; // DMs / unresolved channels have no guild
  if (matches(storage.rules, authorId, guildId)) {
    rest.deleteMessage(channelId, msg.id);
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
