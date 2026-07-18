# Debugging Kettu with RainDevTools

Kettu has a built-in debug bridge (**RainDevTools**). Your phone connects to a
small WebSocket server on your computer; from then on **every `console.log` /
`logger` call and every error on the phone streams to your terminal**, and you
can type JavaScript that runs on the phone.

## 1. Run the server on your computer

The server is the `raindevtools` npm package (by the Kettu author). Run it in a
**real terminal** (not piped/redirected — see the note below):

```bash
npx raindevtools@1.0.3 --port 7864
```

You should see:

```
[..] [SUCCESS] Server running on: ws://localhost:7864
> 
```

Leave it running. The `>` prompt accepts commands (see step 4).

## 2. Find your computer's LAN IP

```bash
ip -o -4 addr show | awk '{print $2, $4}'
```

Use the address on your **Wi-Fi** interface (here: `wlp1s0` → `192.168.12.34`).
Ignore `lo` (127.0.0.1) and any VPN interface (e.g. `wg0` / `10.0.0.1`).

## 3. Connect from the phone

Kettu → **Settings → Developer**:

- **RainDevTools URL**: `192.168.12.34:7864` (your IP + port)
- Tap **Connect to debug WebSocket** → expect a **"Connected to debugger"** toast.

The terminal should print `Connection open: …` and `Client connected: …`.

Requirements:
- Phone and computer on the **same Wi-Fi**.
- No **client isolation** on the router (common on guest networks). Test from the
  phone browser: opening `http://<ip>:7864` should show *"WebSocket connection
  required"*. If that times out, the network is blocking device-to-device.
- The computer's firewall must allow inbound TCP on the port (Arch default: open).

## 4. Use it

- Errors and logs from the phone now appear in the terminal, e.g. a plugin that
  fails to enable prints its exception here.
- Type JavaScript at the `>` prompt to run it **on the phone**; its output comes
  back to the terminal. Useful globals: `window.vendetta`, and installed plugin
  code at `window.vendetta.plugins.plugins`.
- `.ls` lists connected clients, `.help` shows commands, `.q` quits.

## Important note: output buffering

`raindevtools` block-buffers stdout when it is **not** attached to a terminal
(i.e. piped to a file or run headless). In that case connection/log lines are
withheld until the buffer fills, making it look like nothing connected. Fixes:

- Run it in a normal interactive terminal (auto line-buffered), **or**
- Force line-buffering when redirecting:
  ```bash
  stdbuf -oL -eL npx raindevtools@1.0.3 --port 7864 | tee debug.log
  ```

## iOS note

If the phone reaches `http://<ip>:7864` in Safari but the in-app **Connect**
still fails instantly, the app may be blocking insecure `ws://` (App Transport
Security). In that case, use the on-device **Evaluate JavaScript** field instead
to run diagnostics directly (it can read `window.vendetta.plugins.plugins` and
eval a plugin's stored code to surface errors without any network).
