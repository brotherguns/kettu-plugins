#!/usr/bin/env bash
# Starts the RainDevTools debug server for Kettu plugin debugging and prints the
# URL to enter on the phone (Kettu -> Settings -> Developer -> RainDevTools URL).
#
# Usage:
#   ./scripts/debug-server.sh [port]      (default port 7864)
#   bun run debug
#
# Run this in a real terminal (it auto line-buffers). Leave it open; every
# console.log / error from the phone streams here, and you can type JS at the
# `>` prompt to run it on the phone. `.ls` lists clients, `.q` quits.

set -euo pipefail
PORT="${1:-7864}"

# Pick a LAN IPv4: skip loopback and common VPN ranges (10.x from wg/tun).
mapfile -t IPS < <(ip -o -4 addr show 2>/dev/null \
  | awk '$2 != "lo" { sub(/\/.*/, "", $4); print $2" "$4 }')

echo "Detected interfaces:"
BEST=""
for line in "${IPS[@]}"; do
  IFACE="${line%% *}"; ADDR="${line##* }"
  echo "  $IFACE -> $ADDR"
  # prefer a wireless/ethernet iface, avoid wg/tun/10.x VPN
  if [[ "$IFACE" == wl* || "$IFACE" == en* || "$IFACE" == eth* ]] && [[ "$ADDR" != 10.* ]]; then
    BEST="$ADDR"
  fi
done

echo
if [[ -n "$BEST" ]]; then
  echo ">> On your phone, set Kettu RainDevTools URL to:  $BEST:$PORT"
else
  echo ">> Set Kettu RainDevTools URL to  <one-of-the-addresses-above>:$PORT"
fi
echo ">> iOS: also enable Settings -> Privacy -> Local Network -> Discord."
echo

exec npx -y raindevtools@1.0.3 --port "$PORT"
