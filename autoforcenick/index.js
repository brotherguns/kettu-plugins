(function(){var module={exports:{}},exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// plugins/autoforcenick/index.tsx
var autoforcenick_exports = {};
__export(autoforcenick_exports, {
  default: () => autoforcenick_default
});
module.exports = __toCommonJS(autoforcenick_exports);

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
  function getCommandData(channelId, messageId) {
    const url = `/channels/${channelId}/messages/${messageId}/interaction-data`;
    const p = RestAPI.get({ url }).then((body) => body && body.body !== void 0 ? body.body : body);
    return p.catch((e) => {
      logger.error("[kettu-mod] interaction-data failed:", e);
      return null;
    });
  }
  function getForumThreads(forumId, archived, maxThreads) {
    const out = [];
    let offset = 0;
    const limit = 25;
    const page = () => {
      const url = `/channels/${forumId}/threads/search?archived=${archived ? "true" : "false"}&sort_by=last_message_time&sort_order=desc&limit=${limit}&tag_setting=match_some&offset=${offset}`;
      return RestAPI.get({ url }).then((b) => {
        const body = b && b.body !== void 0 ? b.body : b;
        const threads = body && body.threads || [];
        for (let i = 0; i < threads.length; i++) {
          if (threads[i] && threads[i].id)
            out.push(threads[i].id);
        }
        if (threads.length < limit || !body || !body.has_more || out.length >= maxThreads)
          return out;
        offset += limit;
        return page();
      });
    };
    return page().catch((e) => {
      logger.error("[kettu-mod] getForumThreads failed:", e);
      return out;
    });
  }
  function getMessages(channelId, beforeId) {
    let url = `/channels/${channelId}/messages?limit=100`;
    if (beforeId)
      url += "&before=" + beforeId;
    const p = RestAPI.get({ url }).then((body) => {
      const arr = Array.isArray(body) ? body : body && body.body || [];
      return arr;
    });
    return p.catch((e) => {
      logger.error("[kettu-mod] getMessages failed:", e);
      return [];
    });
  }
  return {
    sendMessage(channelId, content) {
      request("post", `/channels/${channelId}/messages`, "sendMessage", { content });
    },
    getCommandData,
    getForumThreads,
    getMessages,
    deleteMessage(channelId, messageId) {
      request("del", `/channels/${channelId}/messages/${messageId}`, "deleteMessage");
    },
    kickMember(guildId, userId) {
      request("del", `/guilds/${guildId}/members/${userId}`, "kickMember");
    },
    // Reads a single guild member's record (resolves to null on failure) so a
    // plugin can inspect the current nickname before deciding to overwrite it.
    getMember(guildId, userId) {
      const url = `/guilds/${guildId}/members/${userId}`;
      const p = RestAPI.get({ url }).then((b) => b && b.body !== void 0 ? b.body : b);
      return p.catch((e) => {
        logger.error("[kettu-mod] getMember failed:", e);
        return null;
      });
    },
    // Forces a member's server nickname. Requires Manage Nicknames in the guild
    // and that the target's highest role sits below yours. Errors are queued and
    // logged (never thrown) so the re-apply loop stays alive.
    setNick(guildId, userId, nick) {
      request(
        "patch",
        `/guilds/${guildId}/members/${userId}`,
        `setNick(${userId})`,
        { nick }
      );
    },
    // `untilISO` is an ISO-8601 timestamp at most 28 days out; null lifts the
    // timeout. Requires Moderate Members in the guild.
    timeoutMember(guildId, userId, untilISO) {
      request(
        "patch",
        `/guilds/${guildId}/members/${userId}`,
        `timeoutMember(${untilISO})`,
        { communication_disabled_until: untilISO }
      );
    },
    dispose() {
      queue.clear();
    }
  };
}

// plugins/autoforcenick/index.tsx
var storage;
var rest = null;
var unsubscribers = [];
var applying = {};
function toast(msg) {
  try {
    vendetta.ui.toasts.showToast(msg);
  } catch (e) {
  }
}
function cfg() {
  const s = storage || vendetta.plugin.storage;
  if (!s.targets)
    s.targets = [];
  if (s.enabled === void 0)
    s.enabled = true;
  return s;
}
function enforce(target) {
  try {
    if (!rest || !target || !target.guildId || !target.userId)
      return;
    const key = target.guildId + ":" + target.userId;
    if (applying[key])
      return;
    applying[key] = true;
    rest.setNick(target.guildId, target.userId, target.nick || "");
    toast("AutoForceNick: reset <@" + target.userId + "> to \u300C" + (target.nick || "") + "\u300D");
    setTimeout(() => {
      applying[key] = false;
    }, 4e3);
  } catch (e) {
  }
}
function selfId() {
  try {
    const U = vendetta.metro.findByProps("getCurrentUser", "getUser");
    const u = U && U.getCurrentUser ? U.getCurrentUser() : null;
    return u && u.id ? u.id : null;
  } catch (e) {
    return null;
  }
}
function onMemberUpdate(payload) {
  try {
    if (!rest)
      return;
    const c = cfg();
    if (c.enabled === false)
      return;
    const guildId = payload && payload.guildId;
    const userId = payload && payload.user && payload.user.id || selfId();
    if (!guildId || !userId)
      return;
    const current = payload && payload.nick || "";
    const targets = c.targets;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.guildId === guildId && t.userId === userId) {
        const desired = t.nick || "";
        if (current !== desired)
          enforce(t);
      }
    }
  } catch (e) {
  }
}
function Settings() {
  const React = vendetta.metro.common.React;
  const RN = vendetta.metro.common.ReactNative;
  const { ScrollView, View, Text, TextInput, TouchableOpacity, Switch } = RN;
  const c = cfg();
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const [enabled, setEnabled] = React.useState(c.enabled !== false);
  const [userId, setUserId] = React.useState("");
  const [guildId, setGuildId] = React.useState("");
  const [nick, setNick] = React.useState("");
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
  const row = { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 };
  const addTarget = () => {
    if (!userId.trim() || !guildId.trim())
      return;
    c.targets.push({ userId: userId.trim(), guildId: guildId.trim(), nick });
    setUserId("");
    setGuildId("");
    setNick("");
    forceUpdate();
  };
  const removeTarget = (i) => {
    c.targets.splice(i, 1);
    forceUpdate();
  };
  const applyNow = (t) => enforce(t);
  return /* @__PURE__ */ React.createElement(
    ScrollView,
    {
      style: { flex: 1 },
      contentContainerStyle: { padding: 16, paddingBottom: 400 },
      keyboardShouldPersistTaps: "handled",
      keyboardDismissMode: "interactive",
      automaticallyAdjustKeyboardInsets: true
    },
    /* @__PURE__ */ React.createElement(View, { style: row }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "600" } }, "Enabled"), /* @__PURE__ */ React.createElement(Switch, { value: enabled, onValueChange: (v) => {
      c.enabled = v;
      setEnabled(v);
      forceUpdate();
    } })),
    /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13, marginBottom: 14 } }, "Reacts the instant a tracked user changes their nickname. No polling."),
    /* @__PURE__ */ React.createElement(Text, { style: label }, "Target User ID"),
    /* @__PURE__ */ React.createElement(TextInput, { style: input, value: userId, onChangeText: setUserId, placeholder: "e.g. 877502759404974110", placeholderTextColor: "#6d6f78", keyboardType: "numeric" }),
    /* @__PURE__ */ React.createElement(Text, { style: label }, "Server (Guild) ID"),
    /* @__PURE__ */ React.createElement(TextInput, { style: input, value: guildId, onChangeText: setGuildId, placeholder: "e.g. 1368145952266911755", placeholderTextColor: "#6d6f78", keyboardType: "numeric" }),
    /* @__PURE__ */ React.createElement(Text, { style: label }, "Forced nickname"),
    /* @__PURE__ */ React.createElement(TextInput, { style: input, value: nick, onChangeText: setNick, placeholder: "the nickname you want", placeholderTextColor: "#6d6f78" }),
    /* @__PURE__ */ React.createElement(TouchableOpacity, { onPress: addTarget, style: { backgroundColor: "#5865f2", borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontWeight: "600", fontSize: 15 } }, "Add target")),
    /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 } }, "Targets (", c.targets.length, ")"),
    c.targets.length === 0 ? /* @__PURE__ */ React.createElement(Text, { style: { color: "#6d6f78" } }, "No targets yet. Add a user + guild + nickname above.") : c.targets.map((t, i) => /* @__PURE__ */ React.createElement(View, { key: t.userId + "-" + t.guildId + "-" + i, style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 15 } }, "<@" + t.userId + ">"), /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, "Server ", t.guildId, " \u2192 \u300C", t.nick || "", "\u300D"), /* @__PURE__ */ React.createElement(View, { style: { flexDirection: "row", marginTop: 8 } }, /* @__PURE__ */ React.createElement(TouchableOpacity, { onPress: () => applyNow(t), style: { backgroundColor: "#3b3d44", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 13 } }, "Apply now")), /* @__PURE__ */ React.createElement(TouchableOpacity, { onPress: () => removeTarget(i), style: { backgroundColor: "#3b3d44", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#f23f43", fontSize: 13 } }, "Remove")))))
  );
}
var plugin = {
  onLoad() {
    try {
      storage = vendetta.plugin.storage;
      if (!storage.targets)
        storage.targets = [];
      if (storage.enabled === void 0)
        storage.enabled = true;
      rest = createRest(vendetta.logger);
      const FD = vendetta.metro.common.FluxDispatcher;
      FD.subscribe("GUILD_MEMBER_UPDATE", onMemberUpdate);
      unsubscribers.push(() => FD.unsubscribe("GUILD_MEMBER_UPDATE", onMemberUpdate));
      toast("AutoForceNick: watching " + storage.targets.length + " target(s)");
    } catch (e) {
      toast("AutoForceNick error: " + (e && e.message ? e.message : String(e)));
    }
  },
  onUnload() {
    try {
      for (let i = 0; i < unsubscribers.length; i++)
        unsubscribers[i]();
    } catch (e) {
    }
    unsubscribers = [];
    try {
      if (rest)
        rest.dispose();
    } catch (e) {
    }
    rest = null;
    applying = {};
  },
  settings: Settings
};
var autoforcenick_default = plugin;

var __d=module.exports&&module.exports.default;return __d?__d:module.exports;})()