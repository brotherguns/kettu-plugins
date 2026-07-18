// Simulate Kettu's VdPluginManager.evalPlugin to catch load/onLoad throws.
import { readFileSync } from "node:fs";

function mockRN() {
  const C = (name) => name; // components are just markers here
  return new Proxy({}, { get: (_t, p) => C(String(p)) });
}

function makeVendetta(storage) {
  const React = {
    useReducer: (r, i) => [i, () => {}],
    useState: (i) => [i, () => {}],
    createElement: (type, props, ...children) => ({ type, props, children }),
    Fragment: "Fragment",
  };
  const FluxDispatcher = { subscribe() {}, unsubscribe() {} };
  const findByProps = (...props) => {
    // RestAPI-ish and ChannelStore-ish stubs
    const bag = {
      getAPIBaseURL: () => "", del: async () => {}, get: async () => {}, post: async () => {},
      getChannel: () => ({ guild_id: "1" }), getDMFromUserId: () => {},
      Forms: {}, TableRow: {}, TableRowGroup: {}, Stack: {}, TextInput: {}, Button: {},
    };
    return bag;
  };
  return {
    metro: { findByProps, common: { React, ReactNative: mockRN(), FluxDispatcher } },
    plugin: { id: "test", manifest: {}, storage },
    logger: { log() {}, error() {}, warn() {} },
    ui: { components: { Forms: undefined, General: mockRN() } }, // Forms deliberately undefined
  };
}

for (const name of ["autodelete", "autokick"]) {
  const js = readFileSync(`dist/${name}/index.js`, "utf8");
  const storage = {};
  const vendetta = makeVendetta(storage);
  try {
    const raw = eval("(vendetta=>{return " + js + "})")(vendetta);
    const ret = typeof raw === "function" ? raw() : raw;
    const plugin = ret?.default ?? ret ?? {};
    console.log(`\n[${name}] loaded OK. keys:`, Object.keys(plugin));
    plugin.onLoad?.();
    console.log(`[${name}] onLoad() OK. storage.rules =`, JSON.stringify(storage.rules));
    // render settings
    if (plugin.settings) {
      const tree = plugin.settings();
      console.log(`[${name}] settings() rendered OK (root type: ${tree?.type})`);
    }
    plugin.onUnload?.();
    console.log(`[${name}] onUnload() OK`);
  } catch (e) {
    console.log(`\n[${name}] THREW:`, e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n") : e);
  }
}
