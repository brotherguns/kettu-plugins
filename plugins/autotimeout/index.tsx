import type { PluginStorage, VendettaPlugin } from "../../vendetta";
import { createRest } from "../../lib/rest";
import { findUserRule, timerKey, type Rule } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";
import { createPermissions } from "../../lib/permissions";
import { createGuilds } from "../../lib/guilds";
import { createGuildBrowser } from "../../lib/GuildBrowser";
import { rollDuration, untilISO } from "../../lib/duration";
import { resolveGuildId } from "../../lib/channels";

// Times a listed user out every time they send a message.
//
// This does not chain into a permanent mute: while timed out they cannot post,
// so nothing re-triggers until the timeout lapses and they speak again. There
// is deliberately no expiry re-apply and no reaction to a moderator lifting it.
//
// A rule names a user only. It fires in whichever server the message was sent
// in, provided we hold Moderate Members there and it isn't switched off in the
// server browser.
//
// Everything that touches the host is deferred into onLoad and guarded, so a
// module-load throw can never stop the plugin from enabling, and any real error
// is surfaced as a toast (debug logs aren't readable on this device).

let storage: PluginStorage;
let rest: ReturnType<typeof createRest> | null = null;
let perms: ReturnType<typeof createPermissions> | null = null;
let guilds: ReturnType<typeof createGuilds> | null = null;
let unsubscribe: (() => void) | null = null;

// When we believe each (guild, user) is muted until. A burst of messages sent
// before Discord applies the first timeout would otherwise fire one PATCH each
// and keep extending the mute past the configured duration.
let mutedUntil: Record<string, number> = {};

function toast(msg: string) {
  try { vendetta.ui.toasts.showToast(msg); } catch (e) { /* ignore */ }
}

// Servers are opt-out, not opt-in: storage holds only the ones switched OFF,
// so a newly joined server is covered with no configuration.
function excluded(): Record<string, boolean> {
  const s = storage || (vendetta.plugin.storage as PluginStorage);
  if (!s.excluded) s.excluded = {};
  return s.excluded;
}

function isExcluded(guildId: string): boolean {
  return excluded()[guildId] === true;
}

function setExcluded(guildId: string, off: boolean) {
  const map = excluded();
  if (off) map[guildId] = true;
  else delete map[guildId];
}

// The guild helper, usable from settings before onLoad has run.
function currentGuilds() {
  if (guilds) return guilds;
  const p = perms || createPermissions(vendetta.logger);
  return createGuilds(vendetta.logger, id => p.canTimeout(id));
}

// How many permitted servers are currently switched on, out of the total.
function serverCounts(): { on: number; total: number } {
  const all = currentGuilds().moderatable();
  let on = 0;
  for (let i = 0; i < all.length; i++) if (!isExcluded(all[i])) on++;
  return { on: on, total: all.length };
}

function onMessage(payload: any) {
  try {
    if (!rest || !perms) return;
    const msg = payload && payload.message;
    if (!msg) return;
    // Ignore our own edits/replays and system messages without an author.
    const userId = msg.author && msg.author.id;
    if (!userId) return;

    const rule = findUserRule(storage.rules, userId);
    if (!rule) return;

    const guildId = resolveGuildId(msg);
    if (!guildId) return; // DM or unresolvable channel
    if (isExcluded(guildId) || !perms.canTimeout(guildId)) return;

    const key = timerKey(guildId, userId);
    const now = Date.now();
    if (mutedUntil[key] && mutedUntil[key] > now) return; // already muted

    const ms = rollDuration(rule);
    mutedUntil[key] = now + ms;
    rest.timeoutMember(guildId, userId, untilISO(now, ms));
  } catch (e) { /* never let one event break the listener */ }
}

const plugin: VendettaPlugin = {
  onLoad() {
    try {
      storage = vendetta.plugin.storage as PluginStorage;
      if (!storage.rules) storage.rules = [];
      rest = createRest(vendetta.logger);
      perms = createPermissions(vendetta.logger);
      guilds = createGuilds(vendetta.logger, id => perms!.canTimeout(id));
      mutedUntil = {};
      const FD = vendetta.metro.common.FluxDispatcher;
      FD.subscribe("MESSAGE_CREATE", onMessage);
      unsubscribe = () => FD.unsubscribe("MESSAGE_CREATE", onMessage);
      toast("AutoTimeout: enabled (" + storage.rules.length + " rule(s))");
    } catch (e: any) {
      toast("AutoTimeout error: " + (e && e.message ? e.message : String(e)));
    }
  },
  onUnload() {
    // Timeouts already applied are left to expire on their own.
    try { if (unsubscribe) unsubscribe(); } catch (e) { /* ignore */ }
    try { if (rest) rest.dispose(); } catch (e) { /* ignore */ }
    unsubscribe = null;
    perms = null;
    guilds = null;
    rest = null;
  },
  settings: createSettingsList({
    guildField: false,
    header: createGuildBrowser({
      list: () => currentGuilds().list(),
      isExcluded,
      setExcluded,
    }),
    choice: {
      key: "mode",
      label: "Duration mode",
      initial: "fixed",
      choices: [
        { value: "fixed", label: "Fixed" },
        { value: "random", label: "Random" },
      ],
    },
    fields: [
      {
        key: "duration",
        label: "Duration (fixed mode only)",
        placeholder: "e.g. 60s, 5m, 2h, 7d",
        initial: "60s",
      },
    ],
    describe: (rule: Rule) => {
      const c = serverCounts();
      const dur = rule.mode === "random" ? "Random 1s–28d" : rule.duration || "60s";
      const where =
        c.on === c.total ? `all ${c.total} servers` : `${c.on} of ${c.total} servers`;
      return "On every message · " + dur + " · " + where;
    },
  }),
};

export default plugin;
