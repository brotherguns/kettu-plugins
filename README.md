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
