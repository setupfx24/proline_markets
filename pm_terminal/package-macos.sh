#!/usr/bin/env bash
# Package the built .app into dist/ProlineMarketsTerminal-<version>-<arch>.dmg —
# the macOS counterpart of the Inno Setup installer built by installer.iss.
#
# Usage:  ./build-macos.sh && ./package-macos.sh
#
# macOS has no installer program in the Windows sense: the convention is a disk
# image holding the .app next to an /Applications symlink, and "installing" is
# dragging one onto the other. That is what this produces.
set -euo pipefail

src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
build="$src/build-macos"
dist="$src/dist"
app_name="Proline Markets Terminal"
app="$build/$app_name.app"

die() { echo "error: $*" >&2; exit 1; }

[[ -d "$app" ]] || die "$app not found — run ./build-macos.sh first"

# The single source of truth for the version is CMakeLists.txt (PM_VERSION),
# which also stamps the bundle. Read it back from the built Info.plist so the
# dmg filename can never drift from what is inside it.
version="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" \
           "$app/Contents/Info.plist")"
# Read the architectures out of the built binary rather than from `uname -m`.
# build-macos.sh produces a universal app whenever the Qt kit allows it, so the
# build machine's own architecture says nothing about what the dmg supports —
# naming a universal image "arm64" because it happened to be built on an M-series
# Mac would tell every Intel user the download cannot work when it can.
# Each slice is tested on its own rather than with one two-arch glob: in
# `*" arm64 "*" x86_64 "*` the space that ends the first slice is the same space
# that must begin the second, so it can never match "arm64 x86_64" and every
# universal build would be mislabelled.
archs="$(lipo -archs "$app/Contents/MacOS/$app_name" 2>/dev/null || true)"
has_arm64=0; has_x86_64=0
case " $archs " in *" arm64 "*)  has_arm64=1  ;; esac
case " $archs " in *" x86_64 "*) has_x86_64=1 ;; esac
if   (( has_arm64 && has_x86_64 )); then arch="universal"
elif (( has_arm64 ));               then arch="arm64"
elif (( has_x86_64 ));              then arch="x86_64"
else die "cannot read architectures from $app/Contents/MacOS/$app_name (lipo said: '$archs')"
fi
dmg="$dist/ProlineMarketsTerminal-$version-$arch.dmg"

# The arch stays in the filename even when universal: the website links to a
# specific name, and a single-arch build slipping out under a name that promised
# both is the failure worth making impossible to miss.
echo "==> Packaging $app_name $version ($arch)"

mkdir -p "$dist"
rm -f "$dmg"

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

# -R, not -a: the bundle's symlinks (Qt frameworks are full of them) must be
# preserved, and cp -R keeps them where a plain copy would flatten each one
# into a duplicate of its target and triple the image size.
cp -R "$app" "$stage/"
ln -s /Applications "$stage/Applications"

# UDZO = zlib-compressed read-only, the standard format for a distributed dmg.
hdiutil create \
    -volname "$app_name" \
    -srcfolder "$stage" \
    -ov -format UDZO \
    "$dmg" >/dev/null

echo "==> Wrote $dmg ($(du -h "$dmg" | cut -f1))"

# Gatekeeper reality check. An ad-hoc signature is enough to RUN the app on the
# machine that built it, but anything downloaded carries a quarantine flag and
# Gatekeeper rejects an app that is not signed with a Developer ID AND
# notarised — with "Proline Markets Terminal is damaged and can't be opened", which
# sounds like a corrupt download rather than a missing certificate.
#
# The signature is read into a variable first instead of being piped straight
# into grep. `set -o pipefail` is on, and `grep -q` exits the instant it
# matches — that SIGPIPEs codesign, so the pipeline returns 141 and the `if`
# reads false. The warning below is the one thing standing between an ad-hoc
# build and a "damaged" dmg on a customer's Mac, and it silently never fired.
sig="$(codesign -dv "$app" 2>&1 || true)"
case "$sig" in
  *Signature=adhoc*)
    cat <<'EOF'

!!  This dmg is AD-HOC SIGNED, not notarised.
    On the build machine it opens normally. On anyone else's Mac, Gatekeeper
    will say "damaged and can't be opened". Two ways forward:

    a) For testers — they run this once after copying it to Applications:
           xattr -dr com.apple.quarantine "/Applications/Proline Markets Terminal.app"

    b) For the website download — sign and notarise properly with an Apple
       Developer account ($99/yr), then staple the ticket:
           PM_SIGN_ID="Developer ID Application: <Name> (<TEAMID>)" ./build-macos.sh
           ./package-macos.sh
           xcrun notarytool submit <dmg> --apple-id <id> --team-id <TEAMID> \
                                         --password <app-specific-pw> --wait
           xcrun stapler staple <dmg>
       Only (b) gives the same click-and-run experience as the Windows
       installer.
EOF
    ;;
esac
