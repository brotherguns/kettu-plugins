// Resolves the guild a message belongs to.
//
// MESSAGE_CREATE payloads do not reliably carry guild_id, so the channel is
// looked up when the message itself doesn't say. Returns null for DMs and
// group DMs, where there is nothing to moderate.
export function resolveGuildId(msg: any): string | null {
  if (!msg) return null;
  if (msg.guild_id) return msg.guild_id;
  if (msg.guildId) return msg.guildId;

  const channelId = msg.channel_id || msg.channelId;
  if (!channelId) return null;

  try {
    const ChannelStore = vendetta.metro.findByProps("getChannel", "getDMFromUserId");
    const ch = ChannelStore && ChannelStore.getChannel && ChannelStore.getChannel(channelId);
    const guildId = ch && ch.guild_id;
    return guildId ? guildId : null;
  } catch (e) {
    return null;
  }
}
