#!/usr/bin/env bash
# Build, sign, notarise and staple a distributable macOS dmg.
#
# This is the step that makes the download actually work for someone who is
# not us. build-macos.sh alone produces an ad-hoc signed app: it runs on the
# machine that built it and nowhere else. Anything downloaded from the web
# carries a quarantine flag, and macOS refuses to launch a quarantined app
# that Apple has not notarised — with "Proline Markets Terminal is damaged and can't
# be opened", which reads as a corrupt download rather than a missing
# certificate. Apple's own syspolicy_check calls it out in as many words:
#
#     Notary Ticket Missing … Severity: Fatal
#
# There is no build flag, entitlement or workaround that avoids this. The only
# fix is a Developer ID certificate plus a round trip through Apple's notary
# service, which is what this script automates.
#
# Usage:
#   PM_SIGN_ID="Developer ID Application: Acme Ltd (AB12CD34EF)" \
#   PM_APPLE_ID="you@example.com" \
#   PM_TEAM_ID="AB12CD34EF" \
#   PM_APPLE_PASSWORD="abcd-efgh-ijkl-mnop" \
#   ./notarize-macos.sh
#
# PM_APPLE_PASSWORD is an APP-SPECIFIC password from appleid.apple.com, not
# the Apple ID password itself. Generate one at:
#   appleid.apple.com → Sign-In and Security → App-Specific Passwords
#
# Alternatively store the credentials once in the keychain and skip three of
# the four variables:
#   xcrun notarytool store-credentials prolinemarket-notary \
#       --apple-id <id> --team-id <TEAMID> --password <app-specific-pw>
#   PM_SIGN_ID="..." PM_NOTARY_PROFILE=prolinemarket-notary ./notarize-macos.sh
set -euo pipefail

src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
build="$src/build-macos"
app_name="Proline Markets Terminal"
app="$build/$app_name.app"

die() { echo "error: $*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "this script only runs on macOS"

# ── credentials ─────────────────────────────────────────────────────────────
[[ -n "${PM_SIGN_ID:-}" ]] || die "PM_SIGN_ID is not set.

  It must be a Developer ID Application identity, exactly as codesign lists it:
      security find-identity -v -p codesigning

  A 'Mac Developer' or 'Apple Development' identity will NOT do — those are for
  local testing and Apple's notary service rejects them."

# Either a stored profile or the three loose credentials, not neither.
notary_args=()
if [[ -n "${PM_NOTARY_PROFILE:-}" ]]; then
    notary_args=(--keychain-profile "$PM_NOTARY_PROFILE")
else
    [[ -n "${PM_APPLE_ID:-}" ]]       || die "set PM_APPLE_ID (or PM_NOTARY_PROFILE)"
    [[ -n "${PM_TEAM_ID:-}" ]]        || die "set PM_TEAM_ID (or PM_NOTARY_PROFILE)"
    [[ -n "${PM_APPLE_PASSWORD:-}" ]] || die "set PM_APPLE_PASSWORD (or PM_NOTARY_PROFILE)"
    notary_args=(--apple-id "$PM_APPLE_ID"
                 --team-id "$PM_TEAM_ID"
                 --password "$PM_APPLE_PASSWORD")
fi

# Fail here rather than after a ten-minute build if the identity is not in the
# keychain — codesign's own error at that point is a bare "no identity found".
security find-identity -v -p codesigning 2>/dev/null | grep -qF "$PM_SIGN_ID" \
    || die "no codesigning identity matching:
    $PM_SIGN_ID
  Available identities:
$(security find-identity -v -p codesigning 2>/dev/null | sed 's/^/    /')"

xcrun notarytool --version >/dev/null 2>&1 \
    || die "xcrun notarytool is unavailable. It ships with Xcode 13+; the
  Command Line Tools alone are not enough. Install Xcode from the App Store."

# ── 1. signed build ─────────────────────────────────────────────────────────
# Handing PM_SIGN_ID to build-macos.sh makes it sign with the hardened runtime,
# a secure timestamp and resources/terminal.entitlements — all three are
# notarisation requirements, and a build signed without them is rejected by the
# notary service rather than by Gatekeeper, much later and less legibly.
echo "==> Building and signing with: $PM_SIGN_ID"
PM_SIGN_ID="$PM_SIGN_ID" "$src/build-macos.sh"

[[ -d "$app" ]] || die "build finished but $app is missing"

# ── 2. notarise the app ─────────────────────────────────────────────────────
# The app is notarised and stapled BEFORE the dmg is built, not just inside it.
# Stapling only the dmg leaves the copy the user drags to /Applications without
# a ticket of its own, so it validates only while the Mac can reach Apple. An
# app stapled first carries its ticket wherever it is copied, offline included.
#
# notarytool takes a zip/dmg/pkg, never a bare .app, so the bundle is zipped
# with ditto — plain `zip` mangles symlinks and extended attributes, and the Qt
# frameworks inside are made of symlinks.
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
zip="$stage/app.zip"

echo "==> Zipping the app for submission…"
/usr/bin/ditto -c -k --keepParent --sequesterRsrc "$app" "$zip"

echo "==> Submitting the app to Apple's notary service (this takes minutes)…"
xcrun notarytool submit "$zip" "${notary_args[@]}" --wait \
    || die "notarisation of the app failed. Ask Apple why:
    xcrun notarytool log <submission-id> ${notary_args[*]:0:2} …"

echo "==> Stapling the ticket to the app…"
xcrun stapler staple "$app"

# ── 3. dmg ──────────────────────────────────────────────────────────────────
echo "==> Packaging the dmg…"
"$src/package-macos.sh"

dmg="$(ls -t "$src/dist"/ProlineMarketsTerminal-*.dmg 2>/dev/null | head -1)"
[[ -n "$dmg" && -f "$dmg" ]] || die "package-macos.sh produced no dmg in $src/dist"

# ── 4. notarise the dmg ─────────────────────────────────────────────────────
# A second round trip, because the dmg is its own signed container: the ticket
# stapled to the app inside says nothing about the disk image the browser
# downloads, and Gatekeeper checks that image first.
echo "==> Submitting the dmg…"
xcrun notarytool submit "$dmg" "${notary_args[@]}" --wait \
    || die "notarisation of the dmg failed"

echo "==> Stapling the ticket to the dmg…"
xcrun stapler staple "$dmg"

# ── 5. verify like a downloader would ───────────────────────────────────────
# `stapler validate` proves the ticket is attached; spctl proves Gatekeeper
# accepts it; syspolicy_check is Apple's own pre-distribution linter and is the
# tool that reported "Notary Ticket Missing / Severity: Fatal" on the ad-hoc
# build. All three must pass, or this dmg is no better than the unsigned one.
echo
echo "==> Verifying…"
xcrun stapler validate "$dmg"  && echo "    dmg ticket   OK"
xcrun stapler validate "$app"  && echo "    app ticket   OK"
spctl --assess --type execute -vv "$app" 2>&1 | sed 's/^/    /'
if command -v syspolicy_check >/dev/null 2>&1; then
    syspolicy_check distribution "$app" 2>&1 | sed 's/^/    /'
fi

echo
echo "==> Done: $dmg"
echo "    This one opens on any Mac, with no Terminal commands."
echo "    Upload it to /opt/prolinemarket/downloads/ under exactly the name the"
echo "    navbar links to, or the download 404s."
