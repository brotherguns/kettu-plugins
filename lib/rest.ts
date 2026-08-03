import type { Logger } from "../vendetta";
import { createQueue } from "./queue";

// Resolves Discord's RestAPI and exposes throttled moderation helpers.
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

  // No async/await — the promise is returned as-is so the bundle stays
  // Hermes-safe. `body` is omitted for verbs that don't carry one.
  function request(verb: "del" | "patch", url: string, label: string, body?: any) {
    queue.push(() => {
      logger.log(`[kettu-mod] ${label} -> ${url}`);
      const opts: any = { url };
      if (body !== undefined) opts.body = body;
      return RestAPI[verb](opts);
    });
  }

  return {
    deleteMessage(channelId: string, messageId: string) {
      request("del", `/channels/${channelId}/messages/${messageId}`, "deleteMessage");
    },
    kickMember(guildId: string, userId: string) {
      request("del", `/guilds/${guildId}/members/${userId}`, "kickMember");
    },
    // `untilISO` is an ISO-8601 timestamp at most 28 days out; null lifts the
    // timeout. Requires Moderate Members in the guild.
    timeoutMember(guildId: string, userId: string, untilISO: string | null) {
      request(
        "patch",
        `/guilds/${guildId}/members/${userId}`,
        `timeoutMember(${untilISO})`,
        { communication_disabled_until: untilISO },
      );
    },
    dispose() {
      queue.clear();
    },
  };
}
