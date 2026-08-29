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

// plugins/resignwatch/index.tsx
var resignwatch_exports = {};
__export(resignwatch_exports, {
  default: () => resignwatch_default
});
module.exports = __toCommonJS(resignwatch_exports);

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

// plugins/resignwatch/index.tsx
var DEFAULT_GUILD_ID = "1130158543237030049";
var DEFAULT_FORUM_ID = "1146892703028760696";
var MAX_PSNS_PER_PERSON = 8;
var MAX_INITIAL_THREADS = 10;
var rest = null;
var subscriptions = [];
var cmdUnregister = null;
function toast(msg) {
  try {
    vendetta.ui.toasts.showToast(msg);
  } catch (e) {
  }
}
function cfg() {
  const s = vendetta.plugin.storage;
  if (!s.resignWatch)
    s.resignWatch = {};
  const c = s.resignWatch;
  if (c.guildId === void 0)
    c.guildId = DEFAULT_GUILD_ID;
  if (c.forumId === void 0)
    c.forumId = DEFAULT_FORUM_ID;
  if (!c.psns)
    c.psns = {};
  if (!c.alerts)
    c.alerts = {};
  return c;
}
var knownThreads = {};
function onThreadCreate(payload) {
  const t = payload && (payload.thread || payload.channel);
  if (t && t.id) {
    knownThreads[t.id] = true;
    backfillThread(t.id);
  }
}
function isInForum(msg) {
  try {
    const c = cfg();
    if (msg.guild_id && msg.guild_id !== c.guildId)
      return false;
    if (msg.channel_id === c.forumId)
      return true;
    if (knownThreads[msg.channel_id])
      return true;
    const ChannelStore = vendetta.metro.findByProps("getChannel", "getChannels");
    const ch = ChannelStore && ChannelStore.getChannel(msg.channel_id);
    if (ch && ch.parent_id === c.forumId)
      return true;
    const id = msg.channel_id;
    if (id && !knownThreads[id] && !ignoredThreads[id] && !fetchingThreads[id] && rest) {
      fetchingThreads[id] = true;
      rest.getChannel(id).then((res) => {
        fetchingThreads[id] = false;
        const parent = res && (res.parent_id || res.parentId);
        const inForum = parent && parent === c.forumId || res && res.id === c.forumId;
        if (inForum) {
          knownThreads[id] = true;
          try {
            window.__rwAsync = { id, parent };
          } catch (_) {
          }
          handleMessage(msg);
        } else {
          ignoredThreads[id] = true;
        }
      }).catch(() => {
        fetchingThreads[id] = false;
      });
    }
    return false;
  } catch (e) {
    return false;
  }
}
function collectText(msg) {
  let t = msg.content || "";
  const embeds = msg.embeds;
  for (let i = 0; i < (embeds ? embeds.length : 0); i++) {
    const e = embeds[i];
    if (e.title)
      t += "\n" + e.title;
    if (e.description)
      t += "\n" + e.description;
    const f = e.fields;
    for (let j = 0; j < (f ? f.length : 0); j++) {
      if (f[j].name)
        t += "\n" + f[j].name;
      if (f[j].value)
        t += "\n" + String(f[j].value);
    }
  }
  return t;
}
function classify(msg) {
  const inter = msg.interaction || msg.interactionMetadata;
  const name = inter && inter.name;
  const text = collectText(msg);
  let cmdName = null;
  if (name === "resign" || name === "encrypt" || name === "decrypt")
    cmdName = name;
  if (!cmdName) {
    let mt = /\/(resign|encrypt|decrypt)\b/i.exec(text);
    if (mt)
      cmdName = mt[1].toLowerCase();
  }
  if (!cmdName && /(?:resign|encrypt)(?:ed|ing)?\s+to\s+/i.test(text))
    cmdName = name || "resign";
  if (!cmdName)
    return null;
  let personId = inter && inter.user && inter.user.id;
  if (!personId && msg.author && !msg.author.bot)
    personId = msg.author.id;
  if (!personId)
    return null;
  return { personId, cmdName, text };
}
function psnFromText(text) {
  let mt = /playstation[\s_]?id\s*[:=]\s*([A-Za-z0-9_.-]+)/i.exec(text);
  if (!mt)
    mt = /(?:resign|encrypt)(?:ed|ing)?\s+to\s+\*\*([A-Za-z0-9_.-]+)\*\*/i.exec(text);
  if (!mt)
    mt = /(?:resign|encrypt)(?:ed|ing)?\s+to\s+([A-Za-z0-9_.-]+)/i.exec(text);
  if (mt)
    return mt[1];
  return null;
}
function parseChannelId(input) {
  if (input === void 0 || input === null)
    return null;
  const s = String(input).trim();
  if (!s)
    return null;
  const m = /(?:discord\.com|discordapp\.com)\/channels\/\d+\/(\d+)/.exec(s);
  if (m)
    return m[1];
  if (/^\d+$/.test(s))
    return s;
  return null;
}
var seenInteractions = {};
var backfilled = {};
var ignoredThreads = {};
var fetchingThreads = {};
var backfillCount = 0;
function backfillThread(threadId) {
  return new Promise((resolve) => {
    if (!rest || !threadId || backfilled[threadId]) {
      resolve();
      return;
    }
    backfilled[threadId] = true;
    backfillCount++;
    let before = null;
    let pages = 0;
    const finish = () => {
      backfillCount--;
      resolve();
    };
    const page = () => {
      if (!rest) {
        finish();
        return;
      }
      rest.getMessages(threadId, before ? before : void 0).then((msgs) => {
        if (!msgs || !msgs.length) {
          finish();
          return;
        }
        for (let i = 0; i < msgs.length; i++)
          handleMessage(msgs[i]);
        if (msgs.length < 100 || pages >= 15) {
          finish();
          return;
        }
        before = msgs[msgs.length - 1].id;
        pages++;
        page();
      }).catch(() => {
        finish();
      });
    };
    page();
  });
}
function onMessage(payload) {
  if (!rest)
    return;
  try {
    const c = cfg();
    if (c.enabled === false)
      return;
    const msg = payload && payload.message;
    if (!msg || !msg.id)
      return;
    if (!isInForum(msg))
      return;
    handleMessage(msg);
  } catch (e) {
  }
}
function handleMessage(msg) {
  try {
    const c = cfg();
    if (c.enabled === false)
      return;
    if (!msg || !msg.id)
      return;
    if (!isInForum(msg))
      return;
    const tid = msg.channel_id;
    if (tid)
      knownThreads[tid] = true;
    if (tid && !backfilled[tid])
      backfillThread(tid);
    const parsed = classify(msg);
    if (!parsed)
      return;
    const iid = msg.interaction && msg.interaction.id || msg.interactionMetadata && msg.interactionMetadata.id;
    if (iid && seenInteractions[iid])
      return;
    if (iid) {
      seenInteractions[iid] = true;
      if (Object.keys(seenInteractions).length > 500) {
        for (const k in seenInteractions) {
          delete seenInteractions[k];
          break;
        }
      }
    }
    const record = (rawPsn) => {
      const psn = rawPsn ? rawPsn.trim().toLowerCase() : null;
      if (!psn)
        return;
      const personId = parsed.personId;
      if (!c.psns[personId])
        c.psns[personId] = [];
      const list = c.psns[personId];
      let known = false;
      for (let i = 0; i < list.length; i++) {
        if (String(list[i]).toLowerCase() === psn) {
          known = true;
          break;
        }
      }
      if (!known) {
        list.push(psn);
        if (list.length > MAX_PSNS_PER_PERSON)
          list.splice(0, list.length - MAX_PSNS_PER_PERSON);
      }
      const key = personId + ":" + psn;
      if (c.alerts[key])
        return;
      c.alerts[key] = true;
      if (list.length < 2)
        return;
      fireAlert(personId, String(list[list.length - 2]), psn, msg.channel_id);
    };
    if (iid && msg.id) {
      rest.getCommandData(msg.channel_id, msg.id).then((body) => {
        let optPsn = null;
        if (body && body.options) {
          for (let i = 0; i < body.options.length; i++) {
            const o = body.options[i];
            if (o && /playstation[\s_]?id/i.test(String(o.name || "")) && o.value != null) {
              optPsn = String(o.value);
              break;
            }
          }
        }
        record(optPsn || psnFromText(parsed.text));
      });
    } else {
      record(psnFromText(parsed.text));
    }
  } catch (e) {
  }
}
function fireAlert(personId, oldPsn, newPsn, srcChannelId) {
  try {
    const link = "https://discord.com/channels/" + cfg().guildId + "/" + srcChannelId;
    const line = "\u{1F6A8} **<@" + personId + "> is resigning to a different PSN!**\n" + oldPsn + " -> " + newPsn + "\n" + link;
    const sc = vendetta.metro.findByProps("getChannelId");
    const target = sc && sc.getChannelId && sc.getChannelId() || srcChannelId;
    try {
      window.__rw = { target, scType: typeof sc, src: srcChannelId, t: Date.now() };
    } catch (_) {
    }
    const mu = vendetta.metro.findByProps("sendBotMessage");
    if (mu && typeof mu.sendBotMessage === "function") {
      mu.sendBotMessage(target, line);
    } else {
      toast(line);
    }
  } catch (e) {
  }
}
function scanThreadById(id) {
  backfillThread(id);
  toast("ResignWatch: scanning " + id);
}
function scanForumInitial(maxThreads) {
  if (!rest) {
    toast("ResignWatch: not ready");
    return;
  }
  const cap = maxThreads || MAX_INITIAL_THREADS;
  toast("ResignWatch: enumerating forum threads...");
  rest.getForumThreads(cfg().forumId, false, cap).then((ids) => {
    if (!ids.length) {
      toast("ResignWatch: no threads found");
      return;
    }
    let i = 0;
    const next = () => {
      if (i >= ids.length) {
        toast("ResignWatch: initial scan queued " + ids.length + " threads");
        return;
      }
      const id = ids[i++];
      backfillThread(id).then(next);
    };
    next();
  }).catch(() => {
    toast("ResignWatch: forum enumeration failed");
  });
}
function registerCommand() {
  const cmds = vendetta.commands;
  if (!cmds || typeof cmds.registerCommand !== "function")
    return;
  cmdUnregister = cmds.registerCommand({
    name: "resignwatch",
    description: "ResignWatch: scan a thread's history, or (no arg) every active forum thread, for multi-PSN resigns",
    args: [
      {
        type: 3,
        name: "target",
        description: "thread ID or discord.com/channels/.../... link (blank = all active threads)",
        required: false
      }
    ],
    execute(args) {
      const target = args && (args.target || (Array.isArray(args) ? args[0] : null));
      if (target) {
        const id = parseChannelId(target);
        if (!id)
          return { result: "ResignWatch: invalid thread ID or link" };
        scanThreadById(id);
        return { result: "ResignWatch: scanning " + id };
      }
      scanForumInitial();
      return { result: "ResignWatch: scanning every active forum thread..." };
    }
  }) || null;
}
function Settings() {
  const React = vendetta.metro.common.React;
  const RN = vendetta.metro.common.ReactNative;
  const { ScrollView, View, Text, TextInput, TouchableOpacity, Switch } = RN;
  const c = cfg();
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const [guildId, setGuildId] = React.useState(c.guildId || "");
  const [forumId, setForumId] = React.useState(c.forumId || "");
  const [enabled, setEnabled] = React.useState(c.enabled !== false);
  const save = () => {
    c.guildId = guildId.trim();
    c.forumId = forumId.trim();
    c.enabled = enabled;
    forceUpdate();
    toast("ResignWatch settings saved");
  };
  const resetTracking = () => {
    c.psns = {};
    c.alerts = {};
    forceUpdate();
    toast("ResignWatch: tracking cleared");
  };
  const personCount = c.psns ? Object.keys(c.psns).length : 0;
  const alertCountTotal = c.alerts ? Object.keys(c.alerts).length : 0;
  const style = {
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
  return /* @__PURE__ */ React.createElement(
    ScrollView,
    {
      style: { flex: 1 },
      contentContainerStyle: { padding: 16, paddingBottom: 400 },
      keyboardShouldPersistTaps: "handled",
      keyboardDismissMode: "interactive",
      automaticallyAdjustKeyboardInsets: true
    },
    /* @__PURE__ */ React.createElement(View, { style: row }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "600" } }, "Enabled"), /* @__PURE__ */ React.createElement(Switch, { value: enabled, onValueChange: setEnabled })),
    /* @__PURE__ */ React.createElement(Text, { style: label }, "Server (Guild) ID"),
    /* @__PURE__ */ React.createElement(TextInput, { style, value: guildId, onChangeText: setGuildId, keyboardType: "numeric", placeholder: DEFAULT_GUILD_ID, placeholderTextColor: "#6d6f78" }),
    /* @__PURE__ */ React.createElement(Text, { style: label }, "Forum (or thread) to watch"),
    /* @__PURE__ */ React.createElement(TextInput, { style, value: forumId, onChangeText: setForumId, keyboardType: "numeric", placeholder: DEFAULT_FORUM_ID, placeholderTextColor: "#6d6f78" }),
    /* @__PURE__ */ React.createElement(TouchableOpacity, { onPress: save, style: { backgroundColor: "#5865f2", borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 10 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontWeight: "600", fontSize: 15 } }, "Save")),
    /* @__PURE__ */ React.createElement(TouchableOpacity, { onPress: resetTracking, style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 12, alignItems: "center" } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#f23f43", fontWeight: "600", fontSize: 15 } }, "Clear tracking")),
    /* @__PURE__ */ React.createElement(View, { style: { marginTop: 18 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 } }, "Tracked: ", personCount, " person(s), ", alertCountTotal, " alert(s) fired"), Object.keys(c.psns || {}).map((id) => /* @__PURE__ */ React.createElement(View, { key: id, style: { backgroundColor: "#2b2d31", borderRadius: 8, padding: 12, marginBottom: 8 } }, /* @__PURE__ */ React.createElement(Text, { style: { color: "#fff", fontSize: 15 } }, "<@" + id + ">"), /* @__PURE__ */ React.createElement(Text, { style: { color: "#b5bac1", fontSize: 13 } }, (c.psns[id] || []).join(" \xB7 ")))))
  );
}
function runSim(ctx) {
  const fd = vendetta.metro.common.FluxDispatcher;
  const mkMsg = (mid, iid, psn) => ({
    id: mid,
    channel_id: "1541533554712772729",
    guild_id: DEFAULT_GUILD_ID,
    content: "",
    author: { id: "1132016483099234364", bot: true },
    interaction: { id: iid, name: "resign", user: { id: "892458481590865920" } },
    interactionMetadata: { id: iid, name: "resign", user: { id: "892458481590865920" } }
  });
  const mkEncrypt = (mid, iid) => ({
    id: mid,
    channel_id: "1541533554712772729",
    guild_id: DEFAULT_GUILD_ID,
    content: "",
    author: { id: "1132016483099234364", bot: true },
    interaction: { id: iid, name: "encrypt", user: { id: "892458481590865920" } },
    interactionMetadata: { id: iid, name: "encrypt", user: { id: "892458481590865920" } }
  });
  fd.dispatch("MESSAGE_CREATE", { message: mkMsg("sim-msg-1", "sim-int-1", "Tikr3r_b") });
  fd.dispatch("MESSAGE_CREATE", { message: mkMsg("sim-msg-2", "sim-int-2", "other_psn") });
  fd.dispatch("MESSAGE_CREATE", { message: mkEncrypt("sim-msg-3", "sim-int-3") });
  return new Promise((resolve) => {
    setTimeout(() => {
      const c = cfg();
      resolve({
        psns: c.psns,
        alerts: Object.keys(c.alerts || {}).length,
        sent: (ctx.vendetta._sent || []).map((o) => o.body && o.body.content)
      });
    }, 4e3);
  });
}
var plugin = {
  onLoad() {
    try {
      storageReady();
      rest = createRest(vendetta.logger);
      const FD = vendetta.metro.common.FluxDispatcher;
      subscriptions = [];
      FD.subscribe("MESSAGE_CREATE", onMessage);
      subscriptions.push(() => FD.unsubscribe("MESSAGE_CREATE", onMessage));
      FD.subscribe("MESSAGE_UPDATE", onMessage);
      subscriptions.push(() => FD.unsubscribe("MESSAGE_UPDATE", onMessage));
      FD.subscribe("THREAD_CREATE", onThreadCreate);
      subscriptions.push(() => FD.unsubscribe("THREAD_CREATE", onThreadCreate));
      registerCommand();
      scanForumInitial();
      toast("ResignWatch: watching " + cfg().forumId);
    } catch (e) {
      toast("ResignWatch error: " + (e && e.message ? e.message : String(e)));
    }
  },
  onUnload() {
    try {
      for (let i = 0; i < subscriptions.length; i++)
        subscriptions[i]();
    } catch (e) {
    }
    subscriptions = [];
    if (cmdUnregister) {
      try {
        cmdUnregister();
      } catch (e) {
      }
      cmdUnregister = null;
    }
    try {
      if (rest)
        rest.dispose();
    } catch (e) {
    }
    rest = null;
  },
  settings: Settings,
  // exposed for scripts/simulate.mjs only — never touched by the loader
  resignwatch: runSim
};
function storageReady() {
  cfg();
}
var resignwatch_default = plugin;

var __d=module.exports&&module.exports.default;return __d?__d:module.exports;})()