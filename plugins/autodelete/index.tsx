import type { PluginStorage, VendettaPlugin } from "../../vendetta";
import { createRest } from "../../lib/rest";
import { matches } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";

const storage = vendetta.plugin.storage as PluginStorage;
storage.rules ??= [];

const logger = vendetta.logger;
const { FluxDispatcher } = vendetta.metro.common;
// MESSAGE_CREATE carries no guild id (verified on-device), so resolve it from
// the channel via ChannelStore.
const ChannelStore = vendetta.metro.findByProps("getChannel", "getDMFromUserId");
const rest = createRest(logger);

function onMessageCreate(payload: any) {
  const msg = payload?.message;
  if (!msg) return;
  const authorId = msg.author?.id;
  const channelId = payload.channelId ?? msg.channel_id;
  const guildId = ChannelStore?.getChannel?.(channelId)?.guild_id;
  if (!guildId) return; // DMs / unresolved channels have no guild
  if (matches(storage.rules, authorId, guildId)) {
    rest.deleteMessage(channelId, msg.id);
  }
}

const plugin: VendettaPlugin = {
  onLoad() {
    FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    logger.log("[AutoDelete] loaded");
  },
  onUnload() {
    FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
    rest.dispose();
    logger.log("[AutoDelete] unloaded");
  },
  settings: createSettingsList(storage),
};

export default plugin;
