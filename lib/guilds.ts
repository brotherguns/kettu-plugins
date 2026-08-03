import type { Logger } from "../vendetta";

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
}

// Enumerates the guilds AutoTimeout may act in: every guild the current user
// has Moderate Members in. Rules name a user only, so the guild set is derived
// at runtime rather than configured.
export function createGuilds(logger: Logger, canTimeout: (guildId: string) => boolean) {
  const GuildStore = vendetta.metro.findByProps("getGuild", "getGuilds");

  return {
    // Guild ids where we hold the permission. Empty on lookup failure, which
    // makes the plugin a no-op rather than blasting every guild with PATCHes.
    moderatable(): string[] {
      return this.list().map(g => g.id);
    },

    // Same set, with the display fields the browser needs. Sorted by name so
    // the list doesn't reshuffle between renders.
    list(): GuildSummary[] {
      try {
        if (!GuildStore) return [];
        const guilds = GuildStore.getGuilds() || {};
        const ids = Object.keys(guilds);
        const out: GuildSummary[] = [];
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          if (!canTimeout(id)) continue;
          const g = guilds[id];
          out.push({ id, name: (g && g.name) || id, icon: (g && g.icon) || null });
        }
        out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        return out;
      } catch (e) {
        logger.error("[kettu-mod] failed to enumerate guilds:", e);
        return [];
      }
    },

  };
}
