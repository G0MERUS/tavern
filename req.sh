#!/data/data/com.termux/files/usr/bin/bash
#
# req.sh — install / update everything Tavern needs (Termux or plain Linux).
#
# Usage (from inside the project folder):
#   ./req.sh
#
# Run this once after cloning, and again whenever you `git pull` updates.
# Then start the server with ./start.sh

set -e

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

# --- 1. System packages (only on Termux) ----------------------------------
# `command -v pkg` is true on Termux. On a normal PC we skip this and assume
# you already have bun + git installed.
if command -v pkg >/dev/null 2>&1; then
  say "Installing system packages (git, bun, unzip)"
  pkg update -y
  pkg install -y git bun unzip
fi

# Make sure bun is actually available before going further.
if ! command -v bun >/dev/null 2>&1; then
  echo "!! 'bun' was not found. Install it first:"
  echo "   Termux:  pkg install bun"
  echo "   Other:   https://bun.sh"
  exit 1
fi

# --- 2. Backend dependencies ----------------------------------------------
say "Installing backend dependencies"
bun install

# --- 3. Frontend dependencies + build -------------------------------------
# Vite (web/vite.config.ts) builds straight into ../dist, which is exactly
# where the server serves the UI from (src/server.ts).
say "Building the web UI"
cd web
bun install
bun run build
cd ..

say "Done. Now run:  ./start.sh"
