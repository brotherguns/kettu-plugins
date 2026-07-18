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
var { React, ReactNative } = vendetta.metro.common;
var { Forms } = vendetta.ui.components;
var { FormInput, FormRow, FormDivider, FormText } = Forms;
var { ScrollView, View } = ReactNative;
function createSettingsList(storage2) {
  return function SettingsList() {
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
    return /* @__PURE__ */ React.createElement(ScrollView, { style: { flex: 1 } }, /* @__PURE__ */ React.createElement(
      FormInput,
      {
        title: "User ID",
        value: userId,
        onChange: (v) => setUserId(v),
        placeholder: "e.g. 877502759404974110"
      }
    ), /* @__PURE__ */ React.createElement(
      FormInput,
      {
        title: "Server (Guild) ID",
        value: guildId,
        onChange: (v) => setGuildId(v),
        placeholder: "e.g. 1368145952266911755"
      }
    ), /* @__PURE__ */ React.createElement(
      FormRow,
      {
        label: "Add rule",
        subLabel: "Adds the user + server pair above",
        onPress: addRule
      }
    ), /* @__PURE__ */ React.createElement(FormDivider, null), storage2.rules.length === 0 ? /* @__PURE__ */ React.createElement(View, { style: { padding: 16 } }, /* @__PURE__ */ React.createElement(FormText, null, "No rules yet. Add a User ID + Server ID above.")) : storage2.rules.map((rule, i) => /* @__PURE__ */ React.createElement(
      FormRow,
      {
        key: `${rule.userId}-${rule.guildId}-${i}`,
        label: `User ${rule.userId}`,
        subLabel: `Server ${rule.guildId} \u2014 tap to remove`,
        onPress: () => removeRule(i)
      }
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