# brotherguns' Kettu plugins

Two moderation plugins for [Kettu](https://codeberg.org/cocobo1/Kettu), in the
**Vendetta plugin** format (installed from a URL, one folder per plugin):

- **AutoDelete** — deletes messages from blacklisted users in configured servers (needs Manage Messages).
- **AutoKick** — kicks blacklisted users on load (sweep) and when they join (needs Kick Members).

Rules are `(user ID, server ID)` pairs, configured in each plugin's settings. Lists are separate per plugin.

## Install in Kettu

In Kettu → Settings → **Plugins** → tap the **+** (add from URL) and paste each
of these (the trailing slash matters):

```
https://brotherguns.github.io/kettu-plugins/autodelete/
https://brotherguns.github.io/kettu-plugins/autokick/
```

Then open each plugin's settings and add `(user ID, server ID)` rules. You must
hold the relevant server permission for actions to succeed; failures are logged
and never crash the client.

## Build & host it yourself

```bash
bun install
bun run build     # -> dist/<plugin>/{manifest.json,index.js}
bun run serve     # serves dist/ on port 4041 for LAN testing
```

For LAN testing, install from `http://<your-ip>:4041/<plugin>/` instead of the
GitHub Pages URLs.

## Publishing updates

Bump nothing manually — the build hashes each bundle, and Vendetta re-fetches
when the `hash` in `manifest.json` changes. After editing source:

```bash
bun run build
# publish the dist/ contents to the gh-pages branch root
```
