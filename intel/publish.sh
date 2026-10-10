#!/usr/bin/env bash
# Publishes a validated advice report to the `intel` branch (and only that branch).
# Usage: intel/publish.sh intel/recommendations.json
set -euo pipefail
src="${1:?usage: intel/publish.sh <report.json>}"
node "$(dirname "$0")/validate.js" "$src"

tmp="$(mktemp -d)"
cp "$src" "$tmp/recommendations.json"
start="$(git rev-parse --abbrev-ref HEAD)"
rm -f "$src"   # an untracked copy would block switching branches

if git fetch -q origin intel 2>/dev/null; then
  git checkout -q -B intel origin/intel
else
  git checkout -q --orphan intel
  git rm -rq --cached . >/dev/null 2>&1 || true
fi
mkdir -p intel
cp "$tmp/recommendations.json" intel/recommendations.json
git add -f intel/recommendations.json
if git diff --cached --quiet; then
  echo "No change from the published report."
else
  git commit -q -m "Weekly hero advice $(date -u +%Y-%m-%d)"
  for i in 1 2 3 4; do git push -q -u origin intel && break || sleep $((2 ** i)); done
  echo "Published to origin/intel."
fi
git checkout -q -f "$start"
git clean -qfd intel >/dev/null 2>&1 || true
cp "$tmp/recommendations.json" "$src"
