(()=>{var module={exports:{}},exports=module.exports;
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
  const delayMs = opts.delayMs ?? 750;
  const onError = opts.onError ?? (() => {
  });
  let pending = [];
  let running = false;
  async function drain() {
    if (running)
      return;
    running = true;
    while (pending.length) {
      const task = pending.shift();
      try {
        await task();
      } catch (e) {
        onError(e);
      }
      if (pending.length && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    running = false;
  }
  return {
    push(task) {
      pending.push(task);
      void drain();
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
function createRest(logger2) {
  const RestAPI = vendetta.metro.findByProps("getAPIBaseURL", "del") ?? vendetta.metro.findByProps("getAPIBaseURL");
  const queue = createQueue({
    delayMs: 750,
    onError: (e) => logger2.error("[kettu-mod] REST action failed:", e)
  });
  function del(url, label) {
    queue.push(async () => {
      logger2.log(`[kettu-mod] ${label} -> ${url}`);
      await RestAPI.del({ url });
    });
  }
  return {
    deleteMessage(channelId, messageId) {
      del(`/channels/${channelId}/messages/${messageId}`, "deleteMessage");
    },
    kickMember(guildId, userId) {
      del(`/guilds/${guildId}/members/${userId}`, "kickMember");
    },
    dispose() {
      queue.clear();
    }
  };
}

// lib/rules.ts
function matches(rules, userId, guildId) {
  if (!userId || !guildId)
    return false;
  return rules.some((r) => r.userId === userId && r.guildId === guildId);
}

// lib/SettingsList.tsx
function createSettingsList(storage2) {
  return function SettingsList() {
    const React = vendetta.metro.common.React;
    const RN = vendetta.metro.common.ReactNative;
    const { ScrollView, View, Text, TextInput, TouchableOpacity } = RN;
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    const [userId, setUserId] = React.useState("");
    const [guildId, setGuildId] = React.useState("");
    const addRule = () => {
      if (!userId.trim() || !guildId.trim())
        return;
      storage2.rules.push({ userId: userId.trim(), guildId: guildId.trim() });
      setUserId("");
      setGuildId("");
      forceUpdate();
    };
    const removeRule = (index) => {
      storage2.rules.splice(index, 1);
      forceUpdate();
    };
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
    return /* @__PURE__ */ React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 16 } }, /* @__PURE__ */ React.createElement(Text, { style: label }, "User ID"), /* @__PURE__ */ React.createElement(
      TextInput,
      {
        style: input,
        value: userId,
        onChangeText: setUserId,
        placeholder: "e.g. 877502759404974110",
        placeholderTextColor: "#6d6f78",
        keyboardType: "numeric"
      }
    ), /* @__PURE__ */ React.createElement(Text, { style: label }, "Server (Guild) ID"), /* @__PURE__ */ React.createElement(
      TextInput,
      {
        style: input,
        value: guildId,
        onChangeText: setGuildId,
        placeholder: "e.g. 1368145952266911755",
        placeholderTextColor: "#6d6f78",
        keyboardType: "numeric"
      }
    ), /* @__PURE__ */ React.createElement(
      TouchableOpacity,
      {
        onPress: addRule,
        style: { backgroundColor: "#5865f2", borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 }
      },
      /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontWeight: "600", fontSize: 15 } }, "Add rule")
    ), /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 } }, "Rules (", storage2.rules.length, ")"), storage2.rules.length === 0 ? /* @__PURE__ */ React.createElement(Text, { style: { color: "#6d6f78" } }, "No rules yet. Add a User ID + Server ID above.") : storage2.rules.map((rule, i) => /* @__PURE__ */ React.createElement(
      TouchableOpacity,
      {
        key: `${rule.userId}-${rule.guildId}-${i}`,
        onPress: () => removeRule(i),
        style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 12, marginBottom: 8 }
      },
      /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 15 } }, "User ", rule.userId),
      /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, "Server ", rule.guildId, " \u2014 tap to remove")
    )));
  };
}

// plugins/autodelete/index.tsx
var storage = vendetta.plugin.storage;
storage.rules ??= [];
var logger = vendetta.logger;
var { FluxDispatcher } = vendetta.metro.common;
var ChannelStore = vendetta.metro.findByProps("getChannel", "getDMFromUserId");
var rest = createRest(logger);
function onMessageCreate(payload) {
  const msg = payload?.message;
  if (!msg)
    return;
  const authorId = msg.author?.id;
  const channelId = payload.channelId ?? msg.channel_id;
  const guildId = ChannelStore?.getChannel?.(channelId)?.guild_id;
  if (!guildId)
    return;
  if (matches(storage.rules, authorId, guildId)) {
    rest.deleteMessage(channelId, msg.id);
  }
}
var plugin = {
  onLoad() {
    FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    logger.log("[AutoDelete] loaded");
  },
  onUnload() {
    FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
    rest.dispose();
    logger.log("[AutoDelete] unloaded");
  },
  settings: createSettingsList(storage)
};
var autodelete_default = plugin;

return module.exports.default??module.exports;})()