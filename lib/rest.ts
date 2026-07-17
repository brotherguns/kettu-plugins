import type { Logger } from "../bunny";
import { createQueue } from "./queue";

export function createRest(logger: Logger) {
  const RestAPI = bunny.metro.findByProps("getAPIBaseURL", "del")
    ?? bunny.metro.findByProps("getAPIBaseURL");

  const queue = createQueue({
    delayMs: 750,
    onError: e => logger.error("[kettu-mod] REST action failed:", e),
  });

  function del(url: string, label: string) {
    queue.push(async () => {
      logger.log(`[kettu-mod] ${label} -> ${url}`);
      await RestAPI.del({ url });
    });
  }

  return {
    deleteMessage(channelId: string, messageId: string) {
      del(`/channels/${channelId}/messages/${messageId}`, "deleteMessage");
    },
    kickMember(guildId: string, userId: string) {
      del(`/guilds/${guildId}/members/${userId}`, "kickMember");
    },
    dispose() {
      queue.clear();
    },
  };
}
