#!/usr/bin/env bash
# Builds resources/prolinemarket.icns — the macOS app icon — from a square PNG master.
#
# macOS will not take the .ico (that is a Windows container) and CMake needs a
# real .icns to drop into Contents/Resources, so this is the mac equivalent of
# what app.rc does on Windows.
#
# Source preference:
#   1. resources/prolinemarket-1024.png   (ideal — every slot is a true downscale)
#   2. resources/prolinemarket-256.png    (what the repo ships; 512/1024 are upscaled)
#
# The 256px master is the app-icon artwork proper: the dark rounded-square tile,
# NOT frontend/trader/public/marketing/prolinemarket_fevicon.png, which is 512px but a
# bare mark on white — correct as a favicon, wrong as a macOS app icon, which is
# always a tile. Upscaling the right artwork beats downscaling the wrong one.
# Drop a 1024px tile in as prolinemarket-1024.png and this script picks it up with no
# other change.
#
# Only sips + iconutil are used, both of which ship with macOS — no Homebrew,
# no ImageMagick.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$here/prolinemarket.icns"

src=""
for cand in "$here/prolinemarket-1024.png" "$here/prolinemarket-256.png"; do
    if [[ -f "$cand" ]]; then src="$cand"; break; fi
done
[[ -n "$src" ]] || { echo "error: no icon master found in $here" >&2; exit 1; }

master_px="$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')"
echo "==> icon master: $(basename "$src") (${master_px}px)"
if (( master_px < 1024 )); then
    echo "    note: slots above ${master_px}px are upscaled. Add a 1024x1024"
    echo "          resources/prolinemarket-1024.png for a sharper Dock icon."
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
set="$work/prolinemarket.iconset"
mkdir -p "$set"

# iconutil requires exactly these names; the @2x entries are what Retina Macs
# actually display, so 32/64/256/512/1024 do most of the visible work.
emit() { # px  filename
    sips -s format png -z "$1" "$1" "$src" --out "$set/$2" >/dev/null
}
emit 16   icon_16x16.png
emit 32   icon_16x16@2x.png
emit 32   icon_32x32.png
emit 64   icon_32x32@2x.png
emit 128  icon_128x128.png
emit 256  icon_128x128@2x.png
emit 256  icon_256x256.png
emit 512  icon_256x256@2x.png
emit 512  icon_512x512.png
emit 1024 icon_512x512@2x.png

iconutil -c icns "$set" -o "$out"
echo "==> wrote $out ($(du -h "$out" | cut -f1))"
