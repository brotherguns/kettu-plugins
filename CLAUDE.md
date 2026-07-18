# Kettu plugins — agent notes

Repo of **Vendetta-format** Kettu plugins (installed by URL, one folder per
plugin). NOT Bunny `spec:3` — this Kettu build installs via `VdPluginManager`.
See `DEBUGGING.md` for the full debug guide and `docs/superpowers/` for the
design/plan.

## Target runtime constraints (Hermes) — DO NOT REGRESS

The device runs **Hermes**, whose eval parser rejects modern syntax. The shipped
bundle MUST NOT contain: optional chaining `?.`, optional call `?.()`, nullish
`??`/`??=`, or `async`/`await`. The esbuild config already down-levels these
(`target: es2017` + `supported` flags) and the source avoids async/await. After
any change, verify the bundle is clean:

```
bun run build
for p in autodelete autokick; do
  echo "$p:"; grep -oE '\?\.|\?\?|async|await' dist/$p/index.js | sort -u
done   # expect no output
```

Plugins export `{ onLoad, onUnload, settings }`; the loader wraps the bundle as
`vendetta => { return <bundle> }`. All host access (storage, RestAPI,
FluxDispatcher, UI components) is deferred into `onLoad`/render and guarded, so a
load-time throw can't block enabling.

## When developing/debugging a plugin: boot RainDevTools first

Whenever the user is developing or debugging a plugin in this repo, start the
RainDevTools debug server so on-device logs/errors stream back and you can run JS
on the phone. Do this proactively at the start of a plugin debugging session.

**Interactive (user runs it):**
```
bun run debug        # prints the phone URL, starts the server
```

**Headless (you run it in the background and drive it):** raindevtools
block-buffers stdout unless line-buffered, and its readline needs an open stdin.
Use a FIFO for stdin (also lets you push eval commands) and `stdbuf`:

```bash
SP="$SCRATCH"          # some writable dir
mkfifo "$SP/cmd.fifo"
( exec 3>"$SP/cmd.fifo"; sleep 86400 ) &            # hold stdin open
stdbuf -oL -eL npx -y raindevtools@1.0.3 --port 7864 < "$SP/cmd.fifo" &  # run_in_background
# send JS to the phone (output streams back into the server log):
printf '%s\n' 'console.log("hi", Object.keys(window.vendetta).join(","))' > "$SP/cmd.fifo"
```

Then tell the user the connect URL: `<LAN-IP>:7864` (their Wi-Fi iface, e.g.
`wl*`/`en*`; not `lo` or the `wg*` VPN). Find it with
`ip -o -4 addr show`.

### Connection troubleshooting (in order)
1. Phone + computer on the **same Wi-Fi**; enter `<LAN-IP>:7864` in Kettu →
   Developer → RainDevTools URL → Connect.
2. **iOS Local Network permission**: Settings → Privacy & Security → Local
   Network → enable **Discord**. Without it, in-app LAN connects fail silently
   (Safari still works). This was the actual blocker once.
3. Router **client isolation** (guest networks) blocks device-to-device.
4. If the server shows no connection but `.ls` and a local `ws` client work, it's
   the phone side (1–3), not the server.

### On-device fallback (no server needed)
Kettu's **Evaluate JavaScript** dev field works even when the WS won't connect.
Installed plugin code lives at `window.vendetta.plugins.plugins` (keyed by the
install URL). To reproduce the loader and surface an error, read that stored
`.js` and eval it as `(0,eval)("vendetta=>{return "+js+"}")(forPlugin)`. Keep
diagnostic snippets free of `?.`/`?.()` (the eval field rejects them too).

## Publishing
Source → `main`; built output → `gh-pages` root (one folder per plugin) with a
`.nojekyll`. Install URLs: `https://brotherguns.github.io/kettu-plugins/<name>/`.
Vendetta re-fetches when a plugin's `manifest.json` `hash` changes (the build
sets it from the bundle content).
