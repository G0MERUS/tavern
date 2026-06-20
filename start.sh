#!/data/data/com.termux/files/usr/bin/bash
#
# start.sh — run the Tavern server.
#
# Usage (from inside the project folder):
#   ./start.sh                 # localhost only — open http://127.0.0.1:8000
#   ./start.sh --host 0.0.0.0  # reachable from other devices on your Wi-Fi
#                              # (a bearer token is auto-generated & printed)
#
# Any extra args are passed straight to the server (e.g. --port 3000).

set -e

# If dependencies/UI aren't built yet, point the user at req.sh.
if [ ! -d "node_modules" ] || [ ! -d "dist" ]; then
  echo "!! Looks like setup hasn't run yet. Run this first:"
  echo "   ./req.sh"
  exit 1
fi

echo "Starting Tavern… open http://127.0.0.1:8000 in your browser."
exec bun run src/index.ts "$@"
