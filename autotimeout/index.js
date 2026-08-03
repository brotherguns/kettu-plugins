(function(){var module={exports:{}},exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugins/autotimeout/index.tsx
var autotimeout_exports = {};
__export(autotimeout_exports, {
  default: () => autotimeout_default
});
module.exports = __toCommonJS(autotimeout_exports);

// lib/queue.ts
function createQueue(opts = {}) {
  var _a, _b;
  const delayMs = (_a = opts.delayMs) != null ? _a : 750;
  const onError = (_b = opts.onError) != null ? _b : () => {
  };
  let pending = [];
  let running = false;
  function scheduleNext() {
    if (pending.length && delayMs > 0) {
      setTimeout(runNext, delayMs);
    } else {
      runNext();
    }
  }
  function runNext() {
    if (!pending.length) {
      running = false;
      return;
    }
    const task = pending.shift();
    let p;
    try {
      p = Promise.resolve(task());
    } catch (e) {
      onError(e);
      p = Promise.resolve();
    }
    p.then(scheduleNext, (e) => {
      onError(e);
      scheduleNext();
    });
  }
  function drain() {
    if (running)
      return;
    running = true;
    runNext();
  }
  return {
    push(task) {
      pending.push(task);
      drain();
    },
    clear() {
      pending = [];
    },
    size() {
      return pending.length;
    }
  };
}

// lib/rest.ts
function createRest(logger) {
  var _a;
  const RestAPI = (_a = vendetta.metro.findByProps("getAPIBaseURL", "del")) != null ? _a : vendetta.metro.findByProps("getAPIBaseURL");
  const queue = createQueue({
    delayMs: 750,
    onError: (e) => logger.error("[kettu-mod] REST action failed:", e)
  });
  function request(verb, url, label, body) {
    queue.push(() => {
      logger.log(`[kettu-mod] ${label} -> ${url}`);
      const opts = { url };
      if (body !== void 0)
        opts.body = body;
      return RestAPI[verb](opts);
    });
  }
  return {
    deleteMessage(channelId, messageId) {
      request("del", `/channels/${channelId}/messages/${messageId}`, "deleteMessage");
    },
    kickMember(guildId, userId) {
      request("del", `/guilds/${guildId}/members/${userId}`, "kickMember");
    },
    // `untilISO` is an ISO-8601 timestamp at most 28 days out; null lifts the
    // timeout. Requires Moderate Members in the guild.
    timeoutMember(guildId, userId, untilISO2) {
      request(
        "patch",
        `/guilds/${guildId}/members/${userId}`,
        `timeoutMember(${untilISO2})`,
        { communication_disabled_until: untilISO2 }
      );
    },
    dispose() {
      queue.clear();
    }
  };
}

// lib/rules.ts
function findUserRule(rules, userId) {
  if (!userId || !rules)
    return null;
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].userId === userId)
      return rules[i];
  }
  return null;
}
function timerKey(guildId, userId) {
  return guildId + ":" + userId;
}

// lib/SettingsList.tsx
function createSettingsList(options = {}) {
  const fields = options.fields || [];
  const choice = options.choice;
  const wantsGuild = options.guildField !== false;
  const Header = options.header;
  return function SettingsList() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const { ScrollView, View, Text, TextInput, TouchableOpacity } = RN;
    const storage2 = vendetta.plugin.storage;
    if (!storage2.rules)
      storage2.rules = [];
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    const [userId, setUserId] = React.useState("");
    const [guildId, setGuildId] = React.useState("");
    const initialExtras = () => {
      const seed = {};
      for (let i = 0; i < fields.length; i++) {
        seed[fields[i].key] = fields[i].initial || "";
      }
      if (choice)
        seed[choice.key] = choice.initial;
      return seed;
    };
    const [extras, setExtras] = React.useState(initialExtras);
    const setExtra = (key, value) => setExtras((prev) => {
      const next = __spreadValues({}, prev);
      next[key] = value;
      return next;
    });
    const addRule = () => {
      if (!userId.trim())
        return;
      if (wantsGuild && !guildId.trim())
        return;
      const rule = { userId: userId.trim() };
      if (wantsGuild)
        rule.guildId = guildId.trim();
      for (let i = 0; i < fields.length; i++) {
        const key = fields[i].key;
        rule[key] = (extras[key] || fields[i].initial || "").trim();
      }
      if (choice)
        rule[choice.key] = extras[choice.key] || choice.initial;
      storage2.rules.push(rule);
      setUserId("");
      setGuildId("");
      setExtras(initialExtras());
      forceUpdate();
    };
    const removeRule = (index) => {
      storage2.rules.splice(index, 1);
      forceUpdate();
    };
    const describe = options.describe || ((rule) => `Server ${rule.guildId}`);
    const input = {
      color: "#fff",
      backgroundColor: "#1e1f22",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      fontSize: 16
    };
    const label = { color: "#b5bac1", fontSize: 13, marginBottom: 4 };
    return (
      // The on-screen keyboard covers the lower half of the sheet, so the
      // scroll area gets a keyboard inset plus enough trailing padding that any
      // field can be scrolled clear of it. keyboardShouldPersistTaps keeps the
      // first tap on "Add rule" working while an input still has focus.
      /* @__PURE__ */ React.createElement(
        ScrollView,
        {
          style: { flex: 1 },
          contentContainerStyle: { padding: 16, paddingBottom: 400 },
          keyboardShouldPersistTaps: "handled",
          keyboardDismissMode: "interactive",
          automaticallyAdjustKeyboardInsets: true
        },
        options.header ? /* @__PURE__ */ React.createElement(View, { style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement(Header, null)) : null,
        /* @__PURE__ */ React.createElement(Text, { style: label }, "User ID"),
        /* @__PURE__ */ React.createElement(
          TextInput,
          {
            style: input,
            value: userId,
            onChangeText: setUserId,
            placeholder: "e.g. 877502759404974110",
            placeholderTextColor: "#6d6f78",
            keyboardType: "numeric"
          }
        ),
        wantsGuild ? /* @__PURE__ */ React.createElement(View, null, /* @__PURE__ */ React.createElement(Text, { style: label }, "Server (Guild) ID"), /* @__PURE__ */ React.createElement(
          TextInput,
          {
            style: input,
            value: guildId,
            onChangeText: setGuildId,
            placeholder: "e.g. 1368145952266911755",
            placeholderTextColor: "#6d6f78",
            keyboardType: "numeric"
          }
        )) : null,
        choice ? /* @__PURE__ */ React.createElement(View, null, /* @__PURE__ */ React.createElement(Text, { style: label }, choice.label), /* @__PURE__ */ React.createElement(View, { style: { flexDirection: "row", marginBottom: 10 } }, choice.choices.map((opt) => {
          const selected = (extras[choice.key] || choice.initial) === opt.value;
          return /* @__PURE__ */ React.createElement(
            TouchableOpacity,
            {
              key: opt.value,
              onPress: () => setExtra(choice.key, opt.value),
              style: {
                flex: 1,
                backgroundColor: selected ? "#5865f2" : "#1e1f22",
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: "center",
                marginRight: 8
              }
            },
            /* @__PURE__ */ React.createElement(Text, { style: { color: selected ? "#fff" : "#b5bac1", fontSize: 14 } }, opt.label)
          );
        }))) : null,
        fields.map((field) => /* @__PURE__ */ React.createElement(View, { key: field.key }, /* @__PURE__ */ React.createElement(Text, { style: label }, field.label), /* @__PURE__ */ React.createElement(
          TextInput,
          {
            style: input,
            value: extras[field.key] || "",
            onChangeText: (v) => setExtra(field.key, v),
            placeholder: field.placeholder || "",
            placeholderTextColor: "#6d6f78"
          }
        ))),
        /* @__PURE__ */ React.createElement(
          TouchableOpacity,
          {
            onPress: addRule,
            style: { backgroundColor: "#5865f2", borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 }
          },
          /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontWeight: "600", fontSize: 15 } }, "Add rule")
        ),
        /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 } }, "Rules (", storage2.rules.length, ")"),
        storage2.rules.length === 0 ? /* @__PURE__ */ React.createElement(Text, { style: { color: "#6d6f78" } }, wantsGuild ? "No rules yet. Add a User ID + Server ID above." : "No rules yet. Add a User ID above.") : storage2.rules.map((rule, i) => /* @__PURE__ */ React.createElement(
          TouchableOpacity,
          {
            key: `${rule.userId}-${rule.guildId}-${i}`,
            onPress: () => removeRule(i),
            style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 12, marginBottom: 8 }
          },
          /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 15 } }, "User ", rule.userId),
          /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, describe(rule), " \u2014 tap to remove")
        ))
      )
    );
  };
}

// lib/permissions.ts
function createPermissions(logger) {
  var _a, _b;
  const PermissionStore = (_a = vendetta.metro.findByProps("getGuildPermissions", "can")) != null ? _a : vendetta.metro.findByProps("can", "computePermissions");
  const constants = (_b = vendetta.metro.findByProps("Permissions", "ChannelTypes")) != null ? _b : vendetta.metro.findByProps("Permissions");
  const GuildStore = vendetta.metro.findByProps("getGuild", "getGuilds");
  const MODERATE_MEMBERS = constants && constants.Permissions ? constants.Permissions.MODERATE_MEMBERS : void 0;
  return {
    // Fails open: if the stores or the flag can't be resolved on this build we
    // return true and let the request itself be the source of truth (a 403 is
    // logged by the REST queue). Silently doing nothing would be worse — the
    // plugin would look broken with no explanation.
    canTimeout(guildId) {
      try {
        if (!PermissionStore || MODERATE_MEMBERS === void 0) {
          logger.log("[kettu-mod] permission check unavailable; attempting anyway");
          return true;
        }
        const guild = GuildStore ? GuildStore.getGuild(guildId) : null;
        return !!PermissionStore.can(MODERATE_MEMBERS, guild || guildId);
      } catch (e) {
        logger.error("[kettu-mod] permission check threw; attempting anyway:", e);
        return true;
      }
    }
  };
}

// lib/guilds.ts
function createGuilds(logger, canTimeout) {
  const GuildStore = vendetta.metro.findByProps("getGuild", "getGuilds");
  return {
    // Guild ids where we hold the permission. Empty on lookup failure, which
    // makes the plugin a no-op rather than blasting every guild with PATCHes.
    moderatable() {
      return this.list().map((g) => g.id);
    },
    // Same set, with the display fields the browser needs. Sorted by name so
    // the list doesn't reshuffle between renders.
    list() {
      try {
        if (!GuildStore)
          return [];
        const guilds2 = GuildStore.getGuilds() || {};
        const ids = Object.keys(guilds2);
        const out = [];
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          if (!canTimeout(id))
            continue;
          const g = guilds2[id];
          out.push({ id, name: g && g.name || id, icon: g && g.icon || null });
        }
        out.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
        return out;
      } catch (e) {
        logger.error("[kettu-mod] failed to enumerate guilds:", e);
        return [];
      }
    }
  };
}

// lib/GuildBrowser.tsx
function initials(name) {
  const words = name.split(/\s+/).filter(Boolean);
  let out = "";
  for (let i = 0; i < words.length && out.length < 2; i++)
    out += words[i][0];
  return out.toUpperCase() || "?";
}
function createGuildBrowser(options) {
  return function GuildBrowser() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const { View, Text, TouchableOpacity, Image, TextInput, ScrollView } = RN;
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    const [query, setQuery] = React.useState("");
    const [expanded, setExpanded] = React.useState(false);
    const all = options.list();
    const needle = query.trim().toLowerCase();
    const shown = needle ? all.filter((g) => g.name.toLowerCase().indexOf(needle) !== -1) : all;
    const offCount = all.filter((g) => options.isExcluded(g.id)).length;
    const toggle = (id) => {
      options.setExcluded(id, !options.isExcluded(id));
      forceUpdate();
    };
    const header = /* @__PURE__ */ React.createElement(
      TouchableOpacity,
      {
        onPress: () => setExpanded(!expanded),
        style: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#2b2d31",
          borderRadius: 8,
          padding: 12,
          marginBottom: 8
        }
      },
      /* @__PURE__ */ React.createElement(View, null, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "700" } }, "Servers"), /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, all.length === 0 ? "None you can time members out in" : offCount === 0 ? `All ${all.length} \u2014 tap to choose` : `${all.length - offCount} of ${all.length} on \u2014 tap to choose`)),
      /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 18 } }, expanded ? "\u25BE" : "\u25B8")
    );
    if (!expanded || all.length === 0)
      return /* @__PURE__ */ React.createElement(View, null, header);
    return /* @__PURE__ */ React.createElement(View, null, header, all.length > 8 ? /* @__PURE__ */ React.createElement(
      TextInput,
      {
        style: {
          color: "#fff",
          backgroundColor: "#1e1f22",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: 8,
          fontSize: 15
        },
        value: query,
        onChangeText: setQuery,
        placeholder: "Search servers",
        placeholderTextColor: "#6d6f78"
      }
    ) : null, /* @__PURE__ */ React.createElement(
      ScrollView,
      {
        style: { maxHeight: 260 },
        nestedScrollEnabled: true,
        keyboardShouldPersistTaps: "handled"
      },
      shown.map((g) => {
        const on = !options.isExcluded(g.id);
        return /* @__PURE__ */ React.createElement(
          TouchableOpacity,
          {
            key: g.id,
            onPress: () => toggle(g.id),
            style: {
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1e1f22",
              borderRadius: 8,
              padding: 10,
              marginBottom: 6,
              opacity: on ? 1 : 0.45
            }
          },
          g.icon ? /* @__PURE__ */ React.createElement(
            Image,
            {
              source: {
                uri: `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64`
              },
              style: { width: 32, height: 32, borderRadius: 16, marginRight: 10 }
            }
          ) : /* @__PURE__ */ React.createElement(
            View,
            {
              style: {
                width: 32,
                height: 32,
                borderRadius: 16,
                marginRight: 10,
                backgroundColor: "#4e5058",
                alignItems: "center",
                justifyContent: "center"
              }
            },
            /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 12, fontWeight: "700" } }, initials(g.name))
          ),
          /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 15, flex: 1 }, numberOfLines: 1 }, g.name),
          /* @__PURE__ */ React.createElement(
            View,
            {
              style: {
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: on ? "#248046" : "#4e5058"
              }
            },
            /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 12, fontWeight: "600" } }, on ? "ON" : "OFF")
          )
        );
      })
    ), shown.length === 0 ? /* @__PURE__ */ React.createElement(Text, { style: { color: "#6d6f78", marginBottom: 8 } }, "No servers match.") : null);
  };
}

// lib/duration.ts
var MIN_MS = 1e3;
var MAX_MS = 28 * 24 * 60 * 60 * 1e3;
var UNIT_MS = {
  s: 1e3,
  m: 60 * 1e3,
  h: 60 * 60 * 1e3,
  d: 24 * 60 * 60 * 1e3
};
function clamp(ms) {
  if (!(ms > 0))
    return MIN_MS;
  if (ms < MIN_MS)
    return MIN_MS;
  if (ms > MAX_MS)
    return MAX_MS;
  return Math.floor(ms);
}
function parseDuration(input, fallback = 60 * 1e3) {
  if (typeof input !== "string")
    return clamp(fallback);
  const text = input.trim().toLowerCase();
  if (!text)
    return clamp(fallback);
  const m = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/.exec(text);
  if (!m)
    return clamp(fallback);
  const value = parseFloat(m[1]);
  const unit = m[2] ? UNIT_MS[m[2]] : UNIT_MS.s;
  return clamp(value * unit);
}
function rollDuration(spec, rng = Math.random) {
  if (spec && spec.mode === "random") {
    return clamp(MIN_MS + rng() * (MAX_MS - MIN_MS));
  }
  return parseDuration(spec && spec.duration ? spec.duration : "");
}
function untilISO(nowMs, durationMs) {
  return new Date(nowMs + clamp(durationMs)).toISOString();
}

// lib/channels.ts
function resolveGuildId(msg) {
  if (!msg)
    return null;
  if (msg.guild_id)
    return msg.guild_id;
  if (msg.guildId)
    return msg.guildId;
  const channelId = msg.channel_id || msg.channelId;
  if (!channelId)
    return null;
  try {
    const ChannelStore = vendetta.metro.findByProps("getChannel", "getDMFromUserId");
    const ch = ChannelStore && ChannelStore.getChannel && ChannelStore.getChannel(channelId);
    const guildId = ch && ch.guild_id;
    return guildId ? guildId : null;
  } catch (e) {
    return null;
  }
}

// plugins/autotimeout/index.tsx
var storage;
var rest = null;
var perms = null;
var guilds = null;
var unsubscribe = null;
var mutedUntil = {};
function toast(msg) {
  try {
    vendetta.ui.toasts.showToast(msg);
  } catch (e) {
  }
}
function excluded() {
  const s = storage || vendetta.plugin.storage;
  if (!s.excluded)
    s.excluded = {};
  return s.excluded;
}
function isExcluded(guildId) {
  return excluded()[guildId] === true;
}
function setExcluded(guildId, off) {
  const map = excluded();
  if (off)
    map[guildId] = true;
  else
    delete map[guildId];
}
function currentGuilds() {
  if (guilds)
    return guilds;
  const p = perms || createPermissions(vendetta.logger);
  return createGuilds(vendetta.logger, (id) => p.canTimeout(id));
}
function serverCounts() {
  const all = currentGuilds().moderatable();
  let on = 0;
  for (let i = 0; i < all.length; i++)
    if (!isExcluded(all[i]))
      on++;
  return { on, total: all.length };
}
function onMessage(payload) {
  try {
    if (!rest || !perms)
      return;
    const msg = payload && payload.message;
    if (!msg)
      return;
    const userId = msg.author && msg.author.id;
    if (!userId)
      return;
    const rule = findUserRule(storage.rules, userId);
    if (!rule)
      return;
    const guildId = resolveGuildId(msg);
    if (!guildId)
      return;
    if (isExcluded(guildId) || !perms.canTimeout(guildId))
      return;
    const key = timerKey(guildId, userId);
    const now = Date.now();
    if (mutedUntil[key] && mutedUntil[key] > now)
      return;
    const ms = rollDuration(rule);
    mutedUntil[key] = now + ms;
    rest.timeoutMember(guildId, userId, untilISO(now, ms));
  } catch (e) {
  }
}
var plugin = {
  onLoad() {
    try {
      storage = vendetta.plugin.storage;
      if (!storage.rules)
        storage.rules = [];
      rest = createRest(vendetta.logger);
      perms = createPermissions(vendetta.logger);
      guilds = createGuilds(vendetta.logger, (id) => perms.canTimeout(id));
      mutedUntil = {};
      const FD = vendetta.metro.common.FluxDispatcher;
      FD.subscribe("MESSAGE_CREATE", onMessage);
      unsubscribe = () => FD.unsubscribe("MESSAGE_CREATE", onMessage);
      toast("AutoTimeout: enabled (" + storage.rules.length + " rule(s))");
    } catch (e) {
      toast("AutoTimeout error: " + (e && e.message ? e.message : String(e)));
    }
  },
  onUnload() {
    try {
      if (unsubscribe)
        unsubscribe();
    } catch (e) {
    }
    try {
      if (rest)
        rest.dispose();
    } catch (e) {
    }
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
      setExcluded
    }),
    choice: {
      key: "mode",
      label: "Duration mode",
      initial: "fixed",
      choices: [
        { value: "fixed", label: "Fixed" },
        { value: "random", label: "Random" }
      ]
    },
    fields: [
      {
        key: "duration",
        label: "Duration (fixed mode only)",
        placeholder: "e.g. 60s, 5m, 2h, 7d",
        initial: "60s"
      }
    ],
    describe: (rule) => {
      const c = serverCounts();
      const dur = rule.mode === "random" ? "Random 1s\u201328d" : rule.duration || "60s";
      const where = c.on === c.total ? `all ${c.total} servers` : `${c.on} of ${c.total} servers`;
      return "On every message \xB7 " + dur + " \xB7 " + where;
    }
  })
};
var autotimeout_default = plugin;

var __d=module.exports&&module.exports.default;return __d?__d:module.exports;})()