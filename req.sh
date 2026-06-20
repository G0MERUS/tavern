#!/data/data/com.termux/files/usr/bin/bash
#
# req.sh — install / update everything Tavern needs (Termux or plain Linux).
#
# Usage (from inside the project folder):
#   ./req.sh
#
# Run this once after cloning, and again whenever you `git pull` updates.
# Then start the server with ./start.sh
#
# Tavern runs on stock Node.js (≥ 22.5) — no Bun, and no native modules to
# compile. SQLite is provided by Node's built-in `node:sqlite`, so there's no
# better-sqlite3 build step (which needs a C/C++ toolchain that Termux makes
# painful). Everything else is pure-JS from npm.

set -e

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

# --- 1. System packages (only on Termux) ----------------------------------
# `command -v pkg` is true on Termux. On a normal PC we skip this and assume
# you already have node + git installed.
if command -v pkg >/dev/null 2>&1; then
  say "Installing system packages (nodejs, git, unzip)"
  pkg update -y
  pkg install -y nodejs git unzip
fi

# Make sure node + npm are actually available before going further.
if ! command -v node >/dev/null 2>&1; then
  echo "!! 'node' was not found. Install Node.js (>= 22.5) first:"
  echo "   Termux:  pkg install nodejs"
  echo "   Other:   https://nodejs.org"
  exit 1
fi

# node:sqlite needs Node 22.5+. Warn early with a clear message rather than
# letting the server crash with a cryptic module error.
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
NODE_MINOR=$(node -p 'process.versions.node.split(".")[1]')
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ]; }; then
  echo "!! Node $(node -v) is too old — Tavern needs >= 22.5 (for node:sqlite)."
  echo "   Termux:  pkg upgrade nodejs"
  exit 1
fi

# --- 2. Backend dependencies ----------------------------------------------
say "Installing backend dependencies"
npm install

# --- 3. Frontend dependencies + build -------------------------------------
# Vite (web/vite.config.ts) builds straight into ../dist, which is exactly
# where the server serves the UI from (src/server.ts).
say "Building the web UI"
cd web
npm install
npm run build
cd ..

say "Done. Now run:  ./start.sh"
