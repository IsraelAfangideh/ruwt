#!/bin/bash
set -e

# ── Network isolation for executor user ──────────────────────────
# Allow loopback (needed for Node/Python internal sockets)
iptables -A OUTPUT -m owner --uid-owner executor -o lo -j ACCEPT
# Block all other outbound traffic — REJECT gives immediate errors (not timeouts)
iptables -A OUTPUT -m owner --uid-owner executor -j REJECT

echo "Network isolation: outbound blocked for executor user"

# ── Start the server as root (spawns code as executor user) ──────
exec node server.js
