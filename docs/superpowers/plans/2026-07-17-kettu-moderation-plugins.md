# Kettu Moderation Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two installable Kettu external plugins — AutoDelete and AutoKick — distributed as a plugin repository the user adds by URL.

**Architecture:** A standalone project bundles each plugin's TS/TSX into an IIFE that the Kettu loader evaluates with `bunny` and `definePlugin` in lexical scope. Pure logic (rule matching, throttled REST queue) lives in a shared `lib/` and is unit-tested with `bun test`. Discord-facing behavior (Flux listeners, REST calls) is verified manually on-device via `/eval`. A build script emits `dist/repo.json` + `dist/builds/<id>/{manifest.json,index.js}`.

**Tech Stack:** TypeScript, esbuild (+ automatic/classic JSX to host React), `bun test`, Node/Bun scripts. Host runtime: Kettu (Bunny/Vendetta-lineage RN Discord mod).

## Global Constraints

- Plugin manifests: `spec: 3`, `type: "plugin"`, `main: "index.js"`.
- Plugin IDs: `brotherguns.autodelete`, `brotherguns.autokick`.
- Author (every manifest): `{ name: "brotherguns", id: "877502759404974110" }`.
- `bunny` and `definePlugin` are provided by the loader at eval time — never `import` them; reference them as ambient globals (`declare const`).
- Each bundle is `format: "iife"`, `globalName: "plugin"`, so the loader's `return plugin?.default ?? plugin` resolves the instance.
- Externalize `react` / `react-native`; reach host React via `bunny.metro.common.React`.
- Config shape per plugin: `{ rules: Array<{ userId: string; guildId: string }> }`.
- `stop()` must remove every Flux subscription and clear queue state — Flux subs are NOT auto-disposed.
- All REST actions go through the shared throttled queue; failures are logged via `bunny.plugin.logger`, never thrown.
- Rules are per-`(userId, guildId)`; no global rules, no labels, no shared list, no history purge (YAGNI).

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `bunny.d.ts`

**Interfaces:**
- Produces: npm scripts `build`, `serve`, `test`; ambient `bunny`/`definePlugin`/JSX types for all plugin source.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "kettu-plugins",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "serve": "node scripts/serve.mjs",
    "test": "bun test"
  },
  "devDependencies": {
    "esbuild": "^0.20.2",
    "typescript": "^5.8.3",
    "@types/react": "19.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react",
    "jsxFactory": "React.createElement",
    "jsxFragmentFactory": "React.Fragment",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["react"],
    "baseUrl": ".",
    "paths": { "@lib/*": ["lib/*"] }
  },
  "include": ["plugins", "lib", "bunny.d.ts"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 4: Create `bunny.d.ts`** (ambient types for the loader-provided globals)

```ts
import type * as React from "react";

export interface Rule { userId: string; guildId: string; }

export interface PluginStorage { rules: Rule[]; }

export interface FluxDispatcher {
  subscribe(type: string, cb: (payload: any) => void): void;
  unsubscribe(type: string, cb: (payload: any) => void): void;
}

export interface Logger {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
}

export interface PluginInstance {
  start?(): void;
  stop?(): void;
  SettingsComponent?(): JSX.Element;
}

export interface Bunny {
  metro: {
    findByProps(...props: string[]): any;
    common: {
      React: typeof React;
      FluxDispatcher: FluxDispatcher;
      [key: string]: any;
    };
  };
  plugin: {
    createStorage<T extends object = any>(): T;
    logger: Logger;
    manifest: any;
  };
  ui: any;
  api: any;
}

declare global {
  const bunny: Bunny;
  const definePlugin: (p: PluginInstance) => PluginInstance;
}
```

- [ ] **Step 5: Install and commit**

```bash
cd /run/media/brotherguns/BROTHERGUNS/kettu-plugins
bun install
git add -A && git commit -m "chore: scaffold kettu-plugins project"
```

Expected: `bun install` completes; esbuild/typescript present in `node_modules`.

---

### Task 2: Rule matching (pure logic, TDD)

**Files:**
- Create: `lib/rules.ts`
- Test: `lib/rules.test.ts`

**Interfaces:**
- Produces: `matches(rules: Rule[], userId: string, guildId: string): boolean` where `Rule = { userId: string; guildId: string }`.

- [ ] **Step 1: Write the failing test** — `lib/rules.test.ts`

```ts
import { expect, test } from "bun:test";
import { matches } from "./rules";

const rules = [
  { userId: "1", guildId: "100" },
  { userId: "2", guildId: "200" },
];

test("matches an exact user+guild pair", () => {
  expect(matches(rules, "1", "100")).toBe(true);
});

test("does not match right user in wrong guild", () => {
  expect(matches(rules, "1", "200")).toBe(false);
});

test("does not match unknown user", () => {
  expect(matches(rules, "9", "100")).toBe(false);
});

test("empty rules never match", () => {
  expect(matches([], "1", "100")).toBe(false);
});

test("ignores undefined ids safely", () => {
  expect(matches(rules, undefined as any, "100")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test lib/rules.test.ts`
Expected: FAIL — `matches` not found / module missing.

- [ ] **Step 3: Write minimal implementation** — `lib/rules.ts`

```ts
export interface Rule {
  userId: string;
  guildId: string;
}

export function matches(rules: Rule[], userId: string, guildId: string): boolean {
  if (!userId || !guildId) return false;
  return rules.some(r => r.userId === userId && r.guildId === guildId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test lib/rules.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rules.ts lib/rules.test.ts
git commit -m "feat: add rule matching helper"
```

---

### Task 3: Throttled sequential queue (pure logic, TDD)

**Files:**
- Create: `lib/queue.ts`
- Test: `lib/queue.test.ts`

**Interfaces:**
- Produces: `createQueue(opts?: { delayMs?: number; onError?: (e: unknown) => void }): { push(task: () => Promise<unknown>): void; clear(): void; size(): number }`.
- Behavior: tasks run one at a time, in FIFO order, with `delayMs` (default 750) awaited between task starts; a task that rejects is caught and passed to `onError`, and does NOT stop the queue; `clear()` empties pending tasks.

- [ ] **Step 1: Write the failing test** — `lib/queue.test.ts`

```ts
import { expect, test } from "bun:test";
import { createQueue } from "./queue";

const flush = () => new Promise(r => setTimeout(r, 50));

test("runs tasks sequentially in FIFO order", async () => {
  const order: number[] = [];
  const q = createQueue({ delayMs: 0 });
  q.push(async () => { order.push(1); });
  q.push(async () => { order.push(2); });
  q.push(async () => { order.push(3); });
  await flush();
  expect(order).toEqual([1, 2, 3]);
});

test("a rejecting task is reported and does not halt the queue", async () => {
  const errors: unknown[] = [];
  const order: number[] = [];
  const q = createQueue({ delayMs: 0, onError: e => errors.push(e) });
  q.push(async () => { throw new Error("boom"); });
  q.push(async () => { order.push(2); });
  await flush();
  expect(errors.length).toBe(1);
  expect(order).toEqual([2]);
});

test("clear() drops pending tasks", async () => {
  const order: number[] = [];
  const q = createQueue({ delayMs: 10 });
  q.push(async () => { order.push(1); });
  q.push(async () => { order.push(2); });
  q.clear();
  await flush();
  expect(order).toEqual([1]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test lib/queue.test.ts`
Expected: FAIL — `createQueue` not found.

- [ ] **Step 3: Write minimal implementation** — `lib/queue.ts`

```ts
export interface Queue {
  push(task: () => Promise<unknown>): void;
  clear(): void;
  size(): number;
}

export function createQueue(
  opts: { delayMs?: number; onError?: (e: unknown) => void } = {},
): Queue {
  const delayMs = opts.delayMs ?? 750;
  const onError = opts.onError ?? (() => {});
  let pending: Array<() => Promise<unknown>> = [];
  let running = false;

  async function drain() {
    if (running) return;
    running = true;
    while (pending.length) {
      const task = pending.shift()!;
      try {
        await task();
      } catch (e) {
        onError(e);
      }
      if (pending.length && delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
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
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test lib/queue.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/queue.ts lib/queue.test.ts
git commit -m "feat: add throttled sequential queue"
```

---

### Task 4: REST wrapper

**Files:**
- Create: `lib/rest.ts`

**Interfaces:**
- Consumes: global `bunny` (Task 1 types), `createQueue` (Task 3).
- Produces: `createRest(logger: Logger): { deleteMessage(channelId, messageId): void; kickMember(guildId, userId): void; dispose(): void }`. Each method enqueues one REST call on the shared throttled queue; errors are logged, never thrown; `dispose()` clears the queue.

> **On-device confirmation before implementing (use `/eval`):** confirm the RestAPI module and method names on the user's instance. Ask the user to run:
> `bunny.metro.findByProps("getAPIBaseURL")` — expect an object; then check it exposes `del` and `delete`/`post`. Kettu's RestAPI typically exposes `RestAPI.del({ url })` and `RestAPI.get/post/put`. Adjust the two URLs/methods below to whatever `/eval` shows. Discord REST routes: delete message = `DELETE /channels/{channelId}/messages/{messageId}`; kick = `DELETE /guilds/{guildId}/members/{userId}`.

- [ ] **Step 1: Implement** — `lib/rest.ts`

```ts
import type { Logger } from "../bunny";
import { createQueue } from "./queue";

export function createRest(logger: Logger) {
  const RestAPI = bunny.metro.findByProps("getAPIBaseURL", "del")
    ?? bunny.metro.findByProps("getAPIBaseURL");

  const queue = createQueue({
    delayMs: 750,
    onError: e => logger.error("[kettu-mod] REST action failed:", e),
  });

  function del(url: string, label: string) {
    queue.push(async () => {
      logger.log(`[kettu-mod] ${label} -> ${url}`);
      await RestAPI.del({ url });
    });
  }

  return {
    deleteMessage(channelId: string, messageId: string) {
      del(`/channels/${channelId}/messages/${messageId}`, "deleteMessage");
    },
    kickMember(guildId: string, userId: string) {
      del(`/guilds/${guildId}/members/${userId}`, "kickMember");
    },
    dispose() {
      queue.clear();
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors in `lib/rest.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/rest.ts
git commit -m "feat: add throttled REST wrapper for delete/kick"
```

---

### Task 5: Shared settings UI component

**Files:**
- Create: `lib/SettingsList.tsx`

**Interfaces:**
- Consumes: global `bunny` (host React + UI components), `PluginStorage` type.
- Produces: `createSettingsList(storage: PluginStorage): () => JSX.Element` — a React component that lists `storage.rules`, provides two text inputs (user ID, guild ID) + an Add button that appends a rule, and a remove control per row that splices it. Mutations write straight to the `storage` proxy; local `React.useState` forces re-render.

> **On-device confirmation before implementing (use `/eval`):** confirm available form components. Ask the user to run:
> `Object.keys(bunny.metro.common.components ?? {})` and `bunny.metro.findByProps("TableRow","TableRowGroup")` and `bunny.metro.findByProps("TextInput")`.
> Use whatever the instance exposes (Kettu ships a design-system set: `TableRowGroup`, `TableRow`, `TextInput`, `Button`, `Stack`). Swap the component names below to match. Keep behavior identical.

- [ ] **Step 1: Implement** — `lib/SettingsList.tsx`

```tsx
import type { PluginStorage } from "../bunny";

const { React } = bunny.metro.common;

// Design-system components — confirm names via /eval (see note above).
const { TableRowGroup, TableRow, TextInput, Button, Stack } =
  bunny.metro.findByProps("TableRowGroup", "TableRow", "Stack");

export function createSettingsList(storage: PluginStorage) {
  return function SettingsList() {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    const [userId, setUserId] = React.useState("");
    const [guildId, setGuildId] = React.useState("");

    const addRule = () => {
      if (!userId.trim() || !guildId.trim()) return;
      storage.rules.push({ userId: userId.trim(), guildId: guildId.trim() });
      setUserId("");
      setGuildId("");
      forceUpdate();
    };

    const removeRule = (index: number) => {
      storage.rules.splice(index, 1);
      forceUpdate();
    };

    return (
      <Stack spacing={12} style={{ padding: 12 }}>
        <TextInput
          label="User ID"
          value={userId}
          onChange={setUserId}
          placeholder="e.g. 877502759404974110"
        />
        <TextInput
          label="Server (Guild) ID"
          value={guildId}
          onChange={setGuildId}
          placeholder="e.g. 1368145952266911755"
        />
        <Button text="Add rule" onPress={addRule} />
        <TableRowGroup title="Rules">
          {storage.rules.map((rule, i) => (
            <TableRow
              key={`${rule.userId}-${rule.guildId}-${i}`}
              label={`User ${rule.userId}`}
              subLabel={`Guild ${rule.guildId}`}
              trailing={<Button text="Remove" onPress={() => removeRule(i)} />}
            />
          ))}
        </TableRowGroup>
      </Stack>
    );
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors (component-name access is untyped/`any`, acceptable).

- [ ] **Step 3: Commit**

```bash
git add lib/SettingsList.tsx
git commit -m "feat: add shared rule-list settings component"
```

---

### Task 6: AutoDelete plugin

**Files:**
- Create: `plugins/autodelete/manifest.json`
- Create: `plugins/autodelete/index.tsx`

**Interfaces:**
- Consumes: `matches` (Task 2), `createRest` (Task 4), `createSettingsList` (Task 5), globals `bunny`/`definePlugin`.
- Produces: default plugin instance (`brotherguns.autodelete`).

- [ ] **Step 1: Create `plugins/autodelete/manifest.json`**

```json
{
  "id": "brotherguns.autodelete",
  "spec": 3,
  "version": "1.0.0",
  "type": "plugin",
  "main": "index.js",
  "display": {
    "name": "AutoDelete",
    "description": "Auto-deletes messages from blacklisted users in configured servers (requires Manage Messages).",
    "authors": [{ "name": "brotherguns", "id": "877502759404974110" }]
  }
}
```

- [ ] **Step 2: Create `plugins/autodelete/index.tsx`**

```tsx
import type { PluginStorage } from "../../bunny";
import { createRest } from "../../lib/rest";
import { matches } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";

const storage = bunny.plugin.createStorage<PluginStorage>();
storage.rules ??= [];

const logger = bunny.plugin.logger;
const { FluxDispatcher } = bunny.metro.common;
const rest = createRest(logger);

function onMessageCreate(payload: any) {
  const msg = payload?.message;
  if (!msg) return;
  const authorId = msg.author?.id;
  const guildId = msg.guild_id ?? payload.guildId;
  if (!guildId) return; // DMs have no guild_id
  if (matches(storage.rules, authorId, guildId)) {
    rest.deleteMessage(msg.channel_id, msg.id);
  }
}

export default definePlugin({
  start() {
    FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    logger.log("[AutoDelete] started");
  },
  stop() {
    FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
    rest.dispose();
    logger.log("[AutoDelete] stopped");
  },
  SettingsComponent: createSettingsList(storage),
});
```

> **On-device confirmation (use `/eval`) before trusting field names:** the `MESSAGE_CREATE` payload shape. Ask the user to add a temporary log or run in a channel and inspect: confirm `payload.message.author.id`, `payload.message.guild_id`, `payload.message.channel_id`, `payload.message.id` exist. Adjust `onMessageCreate` if the shape differs.

- [ ] **Step 3: Commit**

```bash
git add plugins/autodelete
git commit -m "feat: add AutoDelete plugin"
```

---

### Task 7: AutoKick plugin

**Files:**
- Create: `plugins/autokick/manifest.json`
- Create: `plugins/autokick/index.tsx`

**Interfaces:**
- Consumes: `matches` (Task 2), `createRest` (Task 4), `createSettingsList` (Task 5), globals `bunny`/`definePlugin`.
- Produces: default plugin instance (`brotherguns.autokick`).

- [ ] **Step 1: Create `plugins/autokick/manifest.json`**

```json
{
  "id": "brotherguns.autokick",
  "spec": 3,
  "version": "1.0.0",
  "type": "plugin",
  "main": "index.js",
  "display": {
    "name": "AutoKick",
    "description": "Kicks blacklisted users on start (sweep) and whenever they join configured servers (requires Kick Members).",
    "authors": [{ "name": "brotherguns", "id": "877502759404974110" }]
  }
}
```

- [ ] **Step 2: Create `plugins/autokick/index.tsx`**

```tsx
import type { PluginStorage } from "../../bunny";
import { createRest } from "../../lib/rest";
import { matches } from "../../lib/rules";
import { createSettingsList } from "../../lib/SettingsList";

const storage = bunny.plugin.createStorage<PluginStorage>();
storage.rules ??= [];

const logger = bunny.plugin.logger;
const { FluxDispatcher } = bunny.metro.common;
const rest = createRest(logger);

function onMemberAdd(payload: any) {
  const guildId = payload?.guildId ?? payload?.guild_id;
  const userId = payload?.user?.id ?? payload?.member?.user?.id;
  if (matches(storage.rules, userId, guildId)) {
    rest.kickMember(guildId, userId);
  }
}

function sweep() {
  // Attempt a kick for every rule; users not present return 404 (ignored).
  for (const rule of storage.rules) {
    rest.kickMember(rule.guildId, rule.userId);
  }
  logger.log(`[AutoKick] sweep queued ${storage.rules.length} rule(s)`);
}

export default definePlugin({
  start() {
    sweep();
    FluxDispatcher.subscribe("GUILD_MEMBER_ADD", onMemberAdd);
    logger.log("[AutoKick] started");
  },
  stop() {
    FluxDispatcher.unsubscribe("GUILD_MEMBER_ADD", onMemberAdd);
    rest.dispose();
    logger.log("[AutoKick] stopped");
  },
  SettingsComponent: createSettingsList(storage),
});
```

> **On-device confirmation (use `/eval`):** the `GUILD_MEMBER_ADD` payload shape — confirm `payload.guildId` (or `guild_id`) and `payload.user.id` (or `member.user.id`). Adjust `onMemberAdd` to match.

- [ ] **Step 3: Commit**

```bash
git add plugins/autokick
git commit -m "feat: add AutoKick plugin"
```

---

### Task 8: Build script

**Files:**
- Create: `scripts/build.mjs`

**Interfaces:**
- Consumes: `plugins/*/{index.tsx,manifest.json}`.
- Produces: `dist/builds/<id>/{index.js,manifest.json}` and `dist/repo.json`.

- [ ] **Step 1: Implement** — `scripts/build.mjs`

```js
import { build } from "esbuild";
import { readdirSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";
const pluginsDir = join(root, "plugins");
const distDir = join(root, "dist");

if (existsSync(distDir)) rmSync(distDir, { recursive: true });
mkdirSync(join(distDir, "builds"), { recursive: true });

const ids = readdirSync(pluginsDir);
const repo = {
  $meta: { name: "brotherguns' plugins", description: "Moderation plugins for Kettu" },
};

for (const dir of ids) {
  const srcDir = join(pluginsDir, dir);
  const manifest = JSON.parse(readFileSync(join(srcDir, "manifest.json"), "utf8"));
  const id = manifest.id;
  const outDir = join(distDir, "builds", id);
  mkdirSync(outDir, { recursive: true });

  await build({
    entryPoints: [join(srcDir, "index.tsx")],
    bundle: true,
    format: "iife",
    globalName: "plugin",
    outfile: join(outDir, "index.js"),
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    external: ["react", "react-native"],
    target: "esnext",
    legalComments: "none",
  });

  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  repo[id] = { version: manifest.version };
  console.log("built", id);
}

writeFileSync(join(distDir, "repo.json"), JSON.stringify(repo, null, 2));
console.log("wrote repo.json");
```

- [ ] **Step 2: Run the build**

Run: `bun run build`
Expected: prints `built brotherguns.autodelete`, `built brotherguns.autokick`, `wrote repo.json`; `dist/` contains `repo.json` and both `builds/<id>/index.js` + `manifest.json`.

- [ ] **Step 3: Verify the IIFE binds `plugin`**

Run: `grep -c "var plugin" dist/builds/brotherguns.autodelete/index.js`
Expected: `1` (esbuild emitted `var plugin = ...`). If `0`, the `globalName` is wrong — fix before continuing.

- [ ] **Step 4: Verify `bunny` is left as a free global (not bundled/renamed)**

Run: `grep -c "bunny.plugin.createStorage" dist/builds/brotherguns.autodelete/index.js`
Expected: `>= 1` (the reference survives; esbuild treated `bunny` as an ambient global).

- [ ] **Step 5: Commit**

```bash
git add scripts/build.mjs
git commit -m "feat: add esbuild build + repo.json generator"
```

---

### Task 9: Serve script + docs

**Files:**
- Create: `scripts/serve.mjs`
- Create: `README.md`

**Interfaces:**
- Produces: `bun run serve` static server over `dist/` on port 4041.

- [ ] **Step 1: Implement** — `scripts/serve.mjs`

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = 4041;
const types = { ".json": "application/json", ".js": "text/javascript" };

createServer(async (req, res) => {
  try {
    const path = join(distDir, decodeURIComponent(req.url.split("?")[0]));
    const body = await readFile(path);
    res.setHeader("Content-Type", types[extname(path)] ?? "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(port, () => console.log(`serving dist/ on http://<your-ip>:${port}/repo.json`));
```

- [ ] **Step 2: Create `README.md`**

````markdown
# brotherguns' Kettu plugins

Two moderation plugins for [Kettu](https://codeberg.org/cocobo1/Kettu):

- **AutoDelete** — deletes messages from blacklisted users in configured servers (needs Manage Messages).
- **AutoKick** — kicks blacklisted users on enable (sweep) and when they join (needs Kick Members).

Rules are `(user ID, server ID)` pairs, configured in each plugin's settings. Lists are separate per plugin.

## Build & host

```bash
bun install
bun run build     # -> dist/
bun run serve     # serves dist/ on port 4041
```

## Install in Kettu

1. Kettu → Settings → Plugins → add repository URL: `http://<your-ip>:4041/repo.json`
2. Install **AutoDelete** and **AutoKick**.
3. Open each plugin's settings and add `(user ID, server ID)` rules.

You must have the relevant server permission for actions to succeed; failures are logged to the debug console and never crash the client.
````

- [ ] **Step 3: Smoke-test the server**

Run: `bun run serve &` then `curl -s http://localhost:4041/repo.json`
Expected: JSON containing both plugin IDs. Stop the server afterward.

- [ ] **Step 4: Commit**

```bash
git add scripts/serve.mjs README.md
git commit -m "feat: add serve script and README"
```

---

### Task 10: On-device verification

**Files:** none (manual).

Requires the user's phone: build, serve, add repo, install both plugins on a test server where the user holds the needed permission. Use `/eval` for the confirmations flagged in Tasks 4–7 and adjust any module/field names that differ, then rebuild.

- [ ] **Step 1:** `bun run build && bun run serve`; add `http://<ip>:4041/repo.json` in Kettu; install both plugins.
- [ ] **Step 2 (AutoDelete):** add a rule for a test account + test guild; have that account post; confirm the message is deleted and a `[AutoDelete]`/`deleteMessage` line appears in the debug console.
- [ ] **Step 3 (AutoKick sweep):** with the test account already in the server, add a rule and toggle the plugin off/on; confirm the account is kicked and a `sweep`/`kickMember` line appears.
- [ ] **Step 4 (AutoKick join):** have the account rejoin; confirm it is kicked again.
- [ ] **Step 5:** if any `/eval` check revealed different module or field names, apply the fix, rebuild, re-test, and commit with `fix:`.
