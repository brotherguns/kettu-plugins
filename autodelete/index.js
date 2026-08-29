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

// plugins/autodelete/index.tsx
var autodelete_exports = {};
__export(autodelete_exports, {
  default: () => autodelete_default
});
module.exports = __toCommonJS(autodelete_exports);

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
  function getChannel(channelId) {
    const url = `/channels/${channelId}`;
    const p = RestAPI.get({ url }).then((body) => body && body.body !== void 0 ? body.body : body);
    return p.catch((e) => {
      logger.error("[kettu-mod] getChannel failed:", e);
      return null;
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
    getChannel,
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

// lib/rules.ts
function matches(rules, userId, guildId) {
  return findRule(rules, userId, guildId) !== null;
}
function findRule(rules, userId, guildId) {
  if (!userId || !guildId || !rules)
    return null;
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].userId === userId && rules[i].guildId === guildId)
      return rules[i];
  }
  return null;
}

// plugins/autodelete/index.tsx
var storage;
var rest = null;
var unsubscribe = null;
function toast(msg) {
  try {
    vendetta.ui.toasts.showToast(msg);
  } catch (e) {
  }
}
function cfg() {
  const s = storage || vendetta.plugin.storage;
  if (!s.mode)
    s.mode = "channel";
  if (!s.userRules)
    s.userRules = [];
  if (!s.channels)
    s.channels = [];
  return s;
}
function channelIndex(channelId) {
  const list = cfg().channels;
  for (let i = 0; i < list.length; i++) {
    if (list[i].channelId === channelId)
      return i;
  }
  return -1;
}
function onMessageCreate(payload) {
  try {
    if (!rest)
      return;
    const c = cfg();
    const msg = payload && payload.message;
    if (!msg)
      return;
    const authorId = msg.author && msg.author.id;
    const channelId = payload && payload.channelId || msg.channel_id;
    if (!channelId)
      return;
    if (c.mode === "channel") {
      if (channelIndex(channelId) !== -1)
        rest.deleteMessage(channelId, msg.id);
      return;
    }
    const ChannelStore = vendetta.metro.findByProps("getChannel", "getDMFromUserId");
    const ch = ChannelStore && ChannelStore.getChannel && ChannelStore.getChannel(channelId);
    const guildId = ch && ch.guild_id;
    if (!guildId)
      return;
    if (matches(c.userRules, authorId, guildId))
      rest.deleteMessage(channelId, msg.id);
  } catch (e) {
  }
}
function Settings() {
  const React = vendetta.metro.common.React;
  const RN = vendetta.metro.common.ReactNative;
  const { ScrollView, View, Text, TextInput, TouchableOpacity, Switch } = RN;
  const c = cfg();
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const [mode, setMode] = React.useState(c.mode === "channel");
  const [userId, setUserId] = React.useState("");
  const [guildId, setGuildId] = React.useState("");
  const [channelId, setChannelId] = React.useState("");
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
  const addUserRule = () => {
    if (!userId.trim() || !guildId.trim())
      return;
    c.userRules.push({ userId: userId.trim(), guildId: guildId.trim() });
    setUserId("");
    setGuildId("");
    forceUpdate();
  };
  const addChannelRule = () => {
    if (!channelId.trim())
      return;
    if (channelIndex(channelId.trim()) !== -1) {
      toast("Channel already added");
      return;
    }
    c.channels.push({ channelId: channelId.trim() });
    setChannelId("");
    forceUpdate();
  };
  const removeUserRule = (i) => {
    c.userRules.splice(i, 1);
    forceUpdate();
  };
  const removeChannelRule = (i) => {
    c.channels.splice(i, 1);
    forceUpdate();
  };
  return /* @__PURE__ */ React.createElement(
    ScrollView,
    {
      style: { flex: 1 },
      contentContainerStyle: { padding: 16, paddingBottom: 400 },
      keyboardShouldPersistTaps: "handled",
      keyboardDismissMode: "interactive",
      automaticallyAdjustKeyboardInsets: true
    },
    /* @__PURE__ */ React.createElement(View, { style: row }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "600" } }, "Channel mode"), /* @__PURE__ */ React.createElement(
      Switch,
      {
        value: mode,
        onValueChange: (v) => {
          c.mode = v ? "channel" : "user";
          setMode(v);
          forceUpdate();
        }
      }
    )),
    /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13, marginBottom: 14 } }, mode ? "Deletes ANY new message in the channel(s) below, from anyone (needs Manage Messages)." : "Deletes new messages from the listed users in their servers (needs Manage Messages)."),
    mode ? /* @__PURE__ */ React.createElement(View, null, /* @__PURE__ */ React.createElement(Text, { style: label }, "Channel ID"), /* @__PURE__ */ React.createElement(
      TextInput,
      {
        style: input,
        value: channelId,
        onChangeText: setChannelId,
        placeholder: "e.g. 1368145952266911755",
        placeholderTextColor: "#6d6f78",
        keyboardType: "numeric"
      }
    ), /* @__PURE__ */ React.createElement(TouchableOpacity, { onPress: addChannelRule, style: { backgroundColor: "#5865f2", borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontWeight: "600", fontSize: 15 } }, "Add channel")), /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 } }, "Channels (", c.channels.length, ")"), c.channels.length === 0 ? /* @__PURE__ */ React.createElement(Text, { style: { color: "#6d6f78" } }, "No channels yet. Add a Channel ID above.") : c.channels.map((r, i) => /* @__PURE__ */ React.createElement(TouchableOpacity, { key: r.channelId + "-" + i, onPress: () => removeChannelRule(i), style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 15 } }, "Channel ", r.channelId), /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, "tap to remove")))) : /* @__PURE__ */ React.createElement(View, null, /* @__PURE__ */ React.createElement(Text, { style: label }, "User ID"), /* @__PURE__ */ React.createElement(TextInput, { style: input, value: userId, onChangeText: setUserId, placeholder: "e.g. 877502759404974110", placeholderTextColor: "#6d6f78", keyboardType: "numeric" }), /* @__PURE__ */ React.createElement(Text, { style: label }, "Server (Guild) ID"), /* @__PURE__ */ React.createElement(TextInput, { style: input, value: guildId, onChangeText: setGuildId, placeholder: "e.g. 1368145952266911755", placeholderTextColor: "#6d6f78", keyboardType: "numeric" }), /* @__PURE__ */ React.createElement(TouchableOpacity, { onPress: addUserRule, style: { backgroundColor: "#5865f2", borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontWeight: "600", fontSize: 15 } }, "Add user rule")), /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 } }, "User rules (", c.userRules.length, ")"), c.userRules.length === 0 ? /* @__PURE__ */ React.createElement(Text, { style: { color: "#6d6f78" } }, "No rules yet. Add a User ID + Server ID above.") : c.userRules.map((r, i) => /* @__PURE__ */ React.createElement(TouchableOpacity, { key: r.userId + "-" + r.guildId + "-" + i, onPress: () => removeUserRule(i), style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 15 } }, "User ", r.userId), /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, "Server ", r.guildId, " \u2014 tap to remove"))))
  );
}
var plugin = {
  onLoad() {
    try {
      storage = vendetta.plugin.storage;
      if (!storage.mode)
        storage.mode = "channel";
      if (!storage.userRules)
        storage.userRules = [];
      if (!storage.channels)
        storage.channels = [];
      rest = createRest(vendetta.logger);
      const FD = vendetta.metro.common.FluxDispatcher;
      FD.subscribe("MESSAGE_CREATE", onMessageCreate);
      unsubscribe = () => FD.unsubscribe("MESSAGE_CREATE", onMessageCreate);
      const c = cfg();
      const count = c.mode === "channel" ? c.channels.length : c.userRules.length;
      toast("AutoDelete: enabled (" + (c.mode === "channel" ? "channel" : "user") + " mode, " + count + ")");
    } catch (e) {
      toast("AutoDelete error: " + (e && e.message ? e.message : String(e)));
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
    rest = null;
  },
  settings: Settings
};
var autodelete_default = plugin;

var __d=module.exports&&module.exports.default;return __d?__d:module.exports;})()