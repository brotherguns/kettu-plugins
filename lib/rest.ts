import type { Logger } from "../vendetta";
import { createQueue } from "./queue";

// Resolves Discord's RestAPI and exposes throttled delete/kick helpers.
// Every call is queued (sequential, spaced out) and errors are logged, never
// thrown — a missing permission or "not a member" (404) must not break the
// listener or crash the client.
export function createRest(logger: Logger) {
  const RestAPI = vendetta.metro.findByProps("getAPIBaseURL", "del")
    ?? vendetta.metro.findByProps("getAPIBaseURL");

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
