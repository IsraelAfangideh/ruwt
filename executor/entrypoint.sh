#!/bin/bash

# ── Network isolation for executor user ──────────────────────────
# Try iptables-legacy first (works on Fly.io Firecracker VMs which lack nf_tables),
# then fall back to iptables (nf_tables). If neither works, warn but continue.
IPTABLES=""
if iptables-legacy -A OUTPUT -m owner --uid-owner executor -o lo -j ACCEPT 2>/dev/null; then
  IPTABLES="iptables-legacy"
elif iptables -A OUTPUT -m owner --uid-owner executor -o lo -j ACCEPT 2>/dev/null; then
  IPTABLES="iptables"
fi

if [ -n "$IPTABLES" ]; then
  # Block all other outbound traffic — REJECT gives immediate errors (not timeouts)
  $IPTABLES -A OUTPUT -m owner --uid-owner executor -j REJECT
  echo "Network isolation: outbound blocked for executor user (via $IPTABLES)"
else
  echo "WARNING: iptables unavailable — network isolation NOT active. Executor user can make outbound requests."
fi

# ── Start the server as root (spawns code as executor user) ──────
exec node server.js
