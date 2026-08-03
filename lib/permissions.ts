import type { Logger } from "../vendetta";

// Checks whether the current user may time members out in a given guild.
//
// The permission flag is read from Discord's own constants module rather than
// written as a BigInt literal: `1n << 40n` cannot be down-levelled to ES2017,
// so a literal here would break the Hermes-safe build.
export function createPermissions(logger: Logger) {
  const PermissionStore = vendetta.metro.findByProps("getGuildPermissions", "can")
    ?? vendetta.metro.findByProps("can", "computePermissions");
  const constants = vendetta.metro.findByProps("Permissions", "ChannelTypes")
    ?? vendetta.metro.findByProps("Permissions");
  const GuildStore = vendetta.metro.findByProps("getGuild", "getGuilds");

  const MODERATE_MEMBERS =
    constants && constants.Permissions ? constants.Permissions.MODERATE_MEMBERS : undefined;

  return {
    // Fails open: if the stores or the flag can't be resolved on this build we
    // return true and let the request itself be the source of truth (a 403 is
    // logged by the REST queue). Silently doing nothing would be worse — the
    // plugin would look broken with no explanation.
    canTimeout(guildId: string): boolean {
      try {
        if (!PermissionStore || MODERATE_MEMBERS === undefined) {
          logger.log("[kettu-mod] permission check unavailable; attempting anyway");
          return true;
        }
        const guild = GuildStore ? GuildStore.getGuild(guildId) : null;
        // `can` accepts either a guild record or a raw id depending on build.
        return !!PermissionStore.can(MODERATE_MEMBERS, guild || guildId);
      } catch (e) {
        logger.error("[kettu-mod] permission check threw; attempting anyway:", e);
        return true;
      }
    },
  };
}
