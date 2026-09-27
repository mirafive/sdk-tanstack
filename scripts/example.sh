#!/bin/sh
# Builds the example app against a packed tarball of this repo, as npm would install it; the sibling SDKs come from npm.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
packs="$root/examples/.packs"

rm -rf "$packs" && mkdir -p "$packs"
(cd "$root" && bun run build >/dev/null 2>&1 && bun pm pack --quiet --destination "$packs" >/dev/null)

cd "$root/examples/start"
rm -rf node_modules dist bun.lock
bun install
VITE_MIRAFIVE_KEY=mf_example0_publicpublicpublicpublic bun run build
