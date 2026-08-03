import type { PluginStorage, VendettaPlugin } from "../../vendetta";
import { createRest } from "../../lib/rest";
import { createSchedule } from "../../lib/schedule";
import { findRule, ruleKey, type Rule } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";
import { createPermissions } from "../../lib/permissions";
import { rollDuration, untilISO } from "../../lib/duration";

// Keeps listed users timed out for as long as the plugin is enabled.
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
let unsubscribe: (() => void) | null = null;
// Guilds already reported as lacking Moderate Members, so the warning toast
// fires once rather than on every re-apply attempt.
let warned: Record<string, boolean> = {};

function toast(msg: string) {
  try { vendetta.ui.toasts.showToast(msg); } catch (e) { /* ignore */ }
}

// Applies a fresh timeout and arms the re-apply timer for the moment it lapses.
function applyTimeout(rule: Rule) {
  if (!rest || !schedule) return;
  // Checked on every apply, not just at load: a role change mid-session can
  // grant or revoke the permission while the plugin is running.
  if (perms && !perms.canTimeout(rule.guildId)) {
    schedule.cancel(ruleKey(rule));
    if (!warned[rule.guildId]) {
      warned[rule.guildId] = true;
      toast("AutoTimeout: no Moderate Members permission in " + rule.guildId);
    }
    return;
  }
  const ms = rollDuration(rule);
  rest.timeoutMember(rule.guildId, rule.userId, untilISO(Date.now(), ms));
  // Small cushion so the re-apply lands after Discord considers it expired.
  schedule.at(ruleKey(rule), ms + 1000, () => applyTimeout(rule));
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
    const rule = findRule(storage.rules, userId, guildId);
    if (!rule) return;

    const until =
      (payload && payload.communication_disabled_until) ||
      (payload && payload.communicationDisabledUntil) ||
      (payload && payload.member && payload.member.communication_disabled_until);

    // Someone cleared it (or it lapsed) — put it straight back.
    if (isExpired(until)) applyTimeout(rule);
  } catch (e) { /* never let one event break the listener */ }
}

// Times out every rule on enable, without reading member state: an already
// timed-out user simply gets a new duration, which costs one PATCH per rule.
function sweep() {
  const rules = storage.rules || [];
  for (let i = 0; i < rules.length; i++) applyTimeout(rules[i]);
}

const plugin: VendettaPlugin = {
  onLoad() {
    try {
      storage = vendetta.plugin.storage as PluginStorage;
      if (!storage.rules) storage.rules = [];
      rest = createRest(vendetta.logger);
      schedule = createSchedule();
      perms = createPermissions(vendetta.logger);
      warned = {};
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
  },
  settings: createSettingsList({
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
    describe: (rule: Rule) =>
      rule.mode === "random"
        ? `Server ${rule.guildId} — random 1s–28d`
        : `Server ${rule.guildId} — ${rule.duration || "60s"}`,
  }),
};

export default plugin;
