# Kettu Moderation Plugins — Design

Date: 2026-07-17
Author: brotherguns (Discord id `877502759404974110`)

## Overview

Two standalone, installable Kettu (Bunny/Vendetta-lineage mobile Discord mod)
plugins, distributed as an external plugin **repository** the user adds by URL in
Kettu → Settings → Plugins. They are NOT core plugins baked into Kettu source.

Both are **moderation tools**: the user has the relevant server permission
(Manage Messages / Kick Members) and the plugins use Discord's REST API on the
user's behalf.

1. **AutoDelete** (`brotherguns.autodelete`) — deletes every message sent by a
   blacklisted user in a configured server.
2. **AutoKick** (`brotherguns.autokick`) — kicks blacklisted users from a
   configured server: sweeps anyone already present when the plugin starts, and
   kicks them again whenever they (re)join.

The lists are **separate** per plugin.

## External plugin runtime model

When Kettu's plugin manager starts an external plugin it evaluates the bundled
`index.js` inside:

```js
(bunny, definePlugin) => { <index.js>; return plugin?.default ?? plugin; }
```

So the bundle must produce a `plugin` binding (our build uses `definePlugin`).
The `bunny` object exposes (relevant subset):

- `bunny.metro.common.FluxDispatcher` — `.subscribe(type, cb)` / `.unsubscribe(type, cb)`
- `bunny.metro.findByProps(...)` — to grab RestAPI (`findByProps("getAPIBaseURL")`)
- `bunny.plugin.createStorage<T>()` — file-backed reactive config proxy, scoped per plugin
- `bunny.plugin.logger` — logging
- `bunny.ui` / `bunny.metro.common.components` — UI primitives for `SettingsComponent`
- `bunny.api.patcher.*` — auto-disposed patch helpers (not needed here)

Only `bunny.api.*` disposables are auto-cleaned on stop. **Flux subscriptions and
our own state must be cleaned up manually in `stop()`.**

## Repository / build layout

New standalone project at `/run/media/brotherguns/BROTHERGUNS/kettu-plugins`.

Source:
```
plugins/
  autodelete/{index.tsx, manifest.json}
  autokick/{index.tsx, manifest.json}
lib/               # shared helpers (rules matching, REST queue, settings UI)
scripts/build.mjs  # esbuild-based bundler
package.json
```

Built/served output (`dist/`):
```
dist/
  repo.json                       # { "$meta": {name,description}, "<id>": {version}, ... }
  builds/
    autodelete/{manifest.json, index.js}
    autokick/{manifest.json, index.js}
```

`manifest.json` fields: `id`, `spec: 3`, `version`, `type: "plugin"`,
`main: "index.js"`, `display: { name, description, authors: [{ name: "brotherguns",
id: "877502759404974110" }] }`.

The user hosts `dist/` over HTTP (http-server / GitHub Pages), adds the
`.../repo.json` URL in Kettu, and installs each plugin.

### Build tooling

`scripts/build.mjs` uses `esbuild` (the standard Bunny-plugin approach):

- For each plugin dir, bundle `index.tsx` → `dist/builds/<id>/index.js` as an IIFE
  that assigns the plugin to a `plugin` variable in scope. `bunny`/`definePlugin`
  are treated as provided globals (marked external / injected), not imported.
- JSX handled via esbuild's automatic runtime pointing at the host React
  (React is reachable through `bunny.metro.common.React`); settings UI uses host
  components, so React/RN are externalized rather than bundled.
- Copy each `manifest.json` to `dist/builds/<id>/`.
- Generate `dist/repo.json` from the manifests.
- `bun run build`; a `bun run serve` script serves `dist/` on a local port.

## Shared library (`lib/`)

- **`rules`**: config shape `{ rules: Array<{ userId: string; guildId: string }> }`.
  `matches(rules, userId, guildId)` helper.
- **`rest`**: resolves RestAPI once via `findByProps("getAPIBaseURL")`; exposes
  `deleteMessage(channelId, messageId)` and `kickMember(guildId, userId)`.
  All calls go through a **sequential queue** with a small delay between calls to
  avoid rate limits; every call is wrapped so errors (missing perms, 404 not a
  member, already deleted) are logged via `bunny.plugin.logger` and never thrown.
- **`SettingsList`**: a reusable settings component rendering the rule list with
  two text inputs (user ID, guild ID) + Add, and a remove control per row, backed
  by the plugin's `createStorage` proxy and re-rendered via the storage's
  observable hook.

## Plugin: AutoDelete (`brotherguns.autodelete`)

- `start()`: subscribe `MESSAGE_CREATE`.
- Handler: read `message.author.id`, `message.guild_id`, `message.channel_id`,
  `message.id` from the payload; if a rule matches `{author.id, guild_id}`, queue
  `deleteMessage(channel_id, id)`.
- `stop()`: unsubscribe.
- Forward-only — deletes messages while enabled; no history purge.
- `SettingsComponent`: the shared `SettingsList`.

## Plugin: AutoKick (`brotherguns.autokick`)

- `start()`:
  1. **Sweep**: for every rule, queue `kickMember(guildId, userId)`. If the user
     is not in the guild Discord returns 404, which is ignored. This removes
     anyone already present.
  2. Subscribe `GUILD_MEMBER_ADD`.
- Handler: on join, read `guildId` and `user.id` from payload; if a rule matches,
  queue `kickMember(guildId, userId)`.
- `stop()`: unsubscribe.
- Re-enabling (disable → enable) re-runs the sweep, satisfying "sweep on launch +
  watch for joins".
- `SettingsComponent`: the shared `SettingsList`.

## Error handling & safety

- All REST actions run through the shared throttled queue; failures are logged,
  never thrown, so one bad call can't break the listener or crash the client.
- `stop()` always fully unsubscribes and clears queue state, so toggling the
  plugin leaves no dangling listeners.

## Testing / verification

No unit harness exists for Discord internals on the RN mobile mod. Verification is
manual against a test server where the user holds the needed permission:

- Build, serve, add repo, install both plugins.
- AutoDelete: add a rule for a test account + test guild, have it post — confirm
  deletion and a logger line.
- AutoKick: add a rule, confirm the already-present test account is kicked on
  enable, and kicked again on rejoin.
- Each REST action emits a clear `logger` line for confirmation in the debug console.

## Out of scope (YAGNI)

- Global (all-server) rules — per-`(userId, guildId)` only.
- Friendly labels/notes on entries — raw IDs only.
- Shared list between the two plugins — separate lists.
- History purge for AutoDelete — forward-only.
