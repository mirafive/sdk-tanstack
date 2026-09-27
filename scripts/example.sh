#!/bin/sh
# Builds the example app against packed tarballs of this repo and its local siblings, as npm would install them.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
packs="$root/examples/.packs"

rm -rf "$packs" && mkdir -p "$packs"
for repo in sdk-browser sdk-server sdk-react; do
  (cd "$root/../$repo" && bun pm pack --quiet --destination "$packs" >/dev/null)
done
(cd "$root" && bun run build >/dev/null 2>&1 && bun pm pack --quiet --destination "$packs" >/dev/null)

cd "$root/examples/start"
rm -rf node_modules dist bun.lock
bun install
VITE_MIRAFIVE_KEY=mf_example0_publicpublicpublicpublic bun run build
