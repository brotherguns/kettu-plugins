import type { PluginStorage, VendettaPlugin } from "../../vendetta";
import { createRest } from "../../lib/rest";
import { createSchedule } from "../../lib/schedule";
import { findUserRule, timerKey, type Rule } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";
import { createPermissions } from "../../lib/permissions";
import { createGuilds } from "../../lib/guilds";
import { createGuildBrowser } from "../../lib/GuildBrowser";
import { rollDuration, untilISO } from "../../lib/duration";

// Keeps listed users timed out for as long as the plugin is enabled.
//
// A rule names a user only. The guild set is derived at runtime: every guild
// where the current user holds Moderate Members. Nothing is configured per
// server, and losing the permission simply drops that guild from the set.
//
// Re-application is instant in both directions:
//   - a moderator lifting the timeout arrives as GUILD_MEMBER_UPDATE
//   - natural expiry emits no event at all, so when we apply a timeout ending
//     at T we schedule our own timer for T
//
// Everything that touches the host is deferred into onLoad and guarded, so a
// module-load throw can never stop the plugin from enabling, and any real error
// is surfaced as a toast (debug logs aren't readable on this device).

let storage: PluginStorage;
let rest: ReturnType<typeof createRest> | null = null;
let schedule: ReturnType<typeof createSchedule> | null = null;
let perms: ReturnType<typeof createPermissions> | null = null;
let guilds: ReturnType<typeof createGuilds> | null = null;

let unsubscribe: (() => void) | null = null;

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

// Settings can render before onLoad has run, so never assume `storage` is set.
function currentRules(): Rule[] {
  const s = storage || (vendetta.plugin.storage as PluginStorage);
  return (s && s.rules) || [];
}

function isExcluded(guildId: string): boolean {
  return excluded()[guildId] === true;
}

function setExcluded(guildId: string, off: boolean) {
  const map = excluded();
  if (off) {
    map[guildId] = true;
    // Stop the re-apply loop in a server the user just switched off.
    if (schedule) {
      const rules = currentRules();
      for (let i = 0; i < rules.length; i++) {
        schedule.cancel(timerKey(guildId, rules[i].userId));
      }
    }
  } else {
    delete map[guildId];
    // Switching a server back on takes effect immediately.
    const rules = currentRules();
    for (let i = 0; i < rules.length; i++) applyIn(guildId, rules[i]);
  }
}

// Applies a fresh timeout in one guild and arms the re-apply timer for the
// moment it lapses.
function applyIn(guildId: string, rule: Rule) {
  if (!rest || !schedule || !perms) return;
  // Re-checked on every apply, not just at load: a role change mid-session can
  // revoke the permission, and the server browser can switch a server off,
  // while the plugin is running.
  if (isExcluded(guildId) || !perms.canTimeout(guildId)) {
    schedule.cancel(timerKey(guildId, rule.userId));
    return;
  }
  const ms = rollDuration(rule);
  rest.timeoutMember(guildId, rule.userId, untilISO(Date.now(), ms));
  // Small cushion so the re-apply lands after Discord considers it expired.
  schedule.at(timerKey(guildId, rule.userId), ms + 1000, () => applyIn(guildId, rule));
}

// Applies a rule across every guild we can moderate and where the target
// plausibly is a member. Returns how many guilds were targeted.
function applyEverywhere(rule: Rule): number {
  if (!guilds) return 0;
  const ids = guilds.moderatable();
  let n = 0;
  for (let i = 0; i < ids.length; i++) {
    if (isExcluded(ids[i])) continue;
    if (guilds.maybeMember(ids[i], rule.userId)) {
      applyIn(ids[i], rule);
      n++;
    }
  }
  return n;
}

// True when the member has no timeout, or one that has already lapsed.
function isExpired(until: any): boolean {
  if (!until) return true;
  const t = Date.parse(until);
  if (isNaN(t)) return true;
  return t <= Date.now();
}

function onMemberUpdate(payload: any) {
  try {
    const guildId = (payload && payload.guildId) || (payload && payload.guild_id);
    const user = payload && (payload.user || (payload.member && payload.member.user));
    const userId = user && user.id;
    const rule = findUserRule(storage.rules, userId);
    if (!rule || !guildId) return;

    const until =
      (payload && payload.communication_disabled_until) ||
      (payload && payload.communicationDisabledUntil) ||
      (payload && payload.member && payload.member.communication_disabled_until);

    // Someone cleared it (or it lapsed) — put it straight back, in this guild
    // only. applyIn re-checks the permission itself.
    if (isExpired(until)) applyIn(guildId, rule);
  } catch (e) { /* never let one event break the listener */ }
}

// Times out every rule on enable, without reading member state: an already
// timed-out user simply gets a new duration, one PATCH per rule per guild.
function sweep() {
  const rules = storage.rules || [];
  for (let i = 0; i < rules.length; i++) applyEverywhere(rules[i]);
}

// Adding a rule in settings starts the timeout immediately rather than waiting
// for the next reload.
function onRuleAdded(rule: Rule) {
  if (!rest) {
    toast("AutoTimeout: rule saved — enable the plugin to apply it");
    return;
  }
  const n = applyEverywhere(rule);
  toast(
    n > 0
      ? "AutoTimeout: timing out " + rule.userId + " in " + n + " server(s)"
      : "AutoTimeout: no servers where you can time that user out",
  );
}

// Removing a rule stops us fighting the moderator who clears the timeout.
// Any timeout already applied is left to expire on its own.
function onRuleRemoved(rule: Rule) {
  if (!schedule || !guilds || !rule) return;
  const ids = guilds.moderatable();
  for (let i = 0; i < ids.length; i++) schedule.cancel(timerKey(ids[i], rule.userId));
}

const plugin: VendettaPlugin = {
  onLoad() {
    try {
      storage = vendetta.plugin.storage as PluginStorage;
      if (!storage.rules) storage.rules = [];
      rest = createRest(vendetta.logger);
      schedule = createSchedule();
      perms = createPermissions(vendetta.logger);
      guilds = createGuilds(vendetta.logger, id => perms!.canTimeout(id));
      sweep();
      const FD = vendetta.metro.common.FluxDispatcher;
      FD.subscribe("GUILD_MEMBER_UPDATE", onMemberUpdate);
      unsubscribe = () => FD.unsubscribe("GUILD_MEMBER_UPDATE", onMemberUpdate);
      toast("AutoTimeout: enabled (" + storage.rules.length + " rule(s))");
    } catch (e: any) {
      toast("AutoTimeout error: " + (e && e.message ? e.message : String(e)));
    }
  },
  onUnload() {
    // Existing timeouts are deliberately left in place; only our own re-apply
    // timers and pending requests are torn down.
    try { if (unsubscribe) unsubscribe(); } catch (e) { /* ignore */ }
    try { if (schedule) schedule.clear(); } catch (e) { /* ignore */ }
    try { if (rest) rest.dispose(); } catch (e) { /* ignore */ }
    unsubscribe = null;
    schedule = null;
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
      return dur + " · " + where;
    },
    onAdd: onRuleAdded,
    onRemove: onRuleRemoved,
  }),
};

export default plugin;
