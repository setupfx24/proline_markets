#!/usr/bin/env bash
# Build the Proline Markets Terminal as a macOS .app bundle.
# Usage:  ./build-macos.sh            (Release, ad-hoc signed, ready to run)
#
# The mac counterpart of build-msvc.ps1, and it follows the same rule: the
# toolchain is DISCOVERED, not hard-coded, so this works on any machine.
# Override anything with env vars:
#
#   QTDIR=/opt/homebrew/opt/qt        Qt prefix (must include WebEngineWidgets)
#   CMAKE=/path/to/cmake              CMake binary
#   PM_SIGN_ID="Developer ID Application: Acme (TEAMID)"
#                                     Real signing identity. Default is ad-hoc
#                                     ("-"), which runs locally but is not
#                                     distributable — see package-macos.sh.
#   PM_ALLOW_NO_CHART=1               Build without the licensed charting
#                                     library (chart pane will be blank).
set -euo pipefail

src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
build="$src/build-macos"
app_name="Proline Markets Terminal"
app="$build/$app_name.app"

die() { echo "error: $*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "this script only runs on macOS"

# ── the licensed charting library ───────────────────────────────────────────
# web/vendor/ is gitignored (the Advanced Charts licence forbids redistributing
# it), so git can never bring it to a new machine. A build without it produces
# an app that launches fine and shows an empty chart pane — a runtime failure
# that looks like a bug in our code. Refuse up front instead, the same way
# deploy.sh refuses to build the trader frontend without the same bundle.
if [[ ! -f "$src/web/vendor/charting_library/charting_library.standalone.js" ]]; then
    if [[ "${PM_ALLOW_NO_CHART:-}" == "1" ]]; then
        echo "!!  charting library missing — building anyway (chart will be blank)."
    else
        die "TradingView charting library not found at
    web/vendor/charting_library/charting_library.standalone.js

  It is licensed and deliberately gitignored, so every machine needs its own
  copy. From a machine that has it:
      tar -czf cl.tar.gz -C <repo>/desk_terminal/web vendor
  then here:
      tar -xzf cl.tar.gz -C '$src/web/'

  To build without it anyway (blank chart):  PM_ALLOW_NO_CHART=1 ./build-macos.sh"
    fi
fi

# ── Qt ──────────────────────────────────────────────────────────────────────
# Must be a kit that actually ships WebEngineWidgets: the chart is a
# QWebEngineView, so a kit without it configures fine and fails at link time.
qt=""
# Written as `if` blocks with no trailing `&&`: under `set -e` a top-level
# `cond && action` whose condition is false returns 1 and aborts the whole
# script, so probing for something that is legitimately absent (no QTDIR set,
# no Homebrew installed) would kill the build before it could try the next
# candidate. Each probe must be allowed to fail quietly.
try_qt() {
    if [[ -n "${1:-}" && -d "$1/lib/cmake/Qt6WebEngineWidgets" ]]; then qt="$1"; fi
}

try_qt "${QTDIR:-}"
if [[ -z "$qt" ]] && command -v brew >/dev/null 2>&1; then
    try_qt "$(brew --prefix qt 2>/dev/null || true)"
fi
if [[ -z "$qt" ]]; then
    # Official online-installer layout, newest kit first.
    for cand in $(ls -d "$HOME"/Qt/6.*/macos 2>/dev/null | sort -Vr); do
        try_qt "$cand"
        if [[ -n "$qt" ]]; then break; fi
    done
fi
[[ -n "$qt" ]] || die "no Qt 6 kit with WebEngineWidgets found.
  Install one:      brew install qt
  Or point at one:  QTDIR=/path/to/qt/6.x.x/macos ./build-macos.sh"

cmake_bin="${CMAKE:-}"
if [[ -z "$cmake_bin" ]]; then
    cmake_bin="$(command -v cmake || true)"
fi
if [[ -z "$cmake_bin" && -x /Applications/CMake.app/Contents/bin/cmake ]]; then
    cmake_bin=/Applications/CMake.app/Contents/bin/cmake
fi
[[ -n "$cmake_bin" ]] || die "cmake not found. Install it:  brew install cmake"

generator="Unix Makefiles"
if command -v ninja >/dev/null 2>&1; then generator="Ninja"; fi

# ── architectures ───────────────────────────────────────────────────────────
# The Windows build is one exe that runs on every supported machine, and the
# mac build should be no worse. An arm64-only app does not merely run slowly on
# an Intel Mac — it refuses to launch at all (the reverse works, under Rosetta
# 2), and that failure lands on the trader who downloaded it.
#
# So build universal whenever the Qt kit permits it. Official Qt kits ship
# universal frameworks; Homebrew's are native-only, and asking for x86_64
# against those fails at link with a wall of "building for macOS-arm64 but
# attempting to link with file built for macOS-x86_64". Hence the probe rather
# than a hard-coded pair — the script must stay correct on both kinds of kit.
#
#   PM_ARCHS="arm64"          override, e.g. for a faster local iteration
#   PM_ARCHS="arm64;x86_64"   force universal
archs="${PM_ARCHS:-}"
if [[ -z "$archs" ]]; then
    qt_archs="$(lipo -archs "$qt/lib/QtCore.framework/Versions/A/QtCore" 2>/dev/null || true)"
    if [[ "$qt_archs" == *x86_64* && "$qt_archs" == *arm64* ]]; then
        archs="arm64;x86_64"
    else
        archs="$(uname -m)"
        echo "!!  Qt kit is $qt_archs only — building for $archs."
        echo "    This app will NOT launch on a Mac of the other architecture."
    fi
fi

echo "    Qt        : $qt"
echo "    CMake     : $cmake_bin"
echo "    Generator : $generator"
echo "    Host      : $(uname -m)"
echo "    Building  : $archs"

# ── icon ────────────────────────────────────────────────────────────────────
[[ -f "$src/resources/prolinemarket.icns" ]] || "$src/resources/make-icns.sh"

# ── stale build tree ────────────────────────────────────────────────────────
# A build tree records the absolute source path it was configured from, so a
# tree copied in from another checkout fails every configure with a
# CMAKE_HOME_DIRECTORY mismatch. Start clean rather than asking the user to.
if [[ -f "$build/CMakeCache.txt" ]]; then
    prev="$(awk -F= '/^CMAKE_HOME_DIRECTORY:INTERNAL=/{print $2}' "$build/CMakeCache.txt")"
    if [[ -n "$prev" && "${prev%/}" != "${src%/}" ]]; then
        echo "==> Stale build tree from $prev — removing."
        rm -rf "$build"
    fi
fi

echo "==> Configuring..."
"$cmake_bin" -S "$src" -B "$build" -G "$generator" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_PREFIX_PATH="$qt" \
    -DCMAKE_OSX_ARCHITECTURES="$archs" \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0

echo "==> Building..."
"$cmake_bin" --build "$build" -j "$(sysctl -n hw.ncpu)"

[[ -d "$app" ]] || die "build finished but $app is missing"

# ── Qt runtime ──────────────────────────────────────────────────────────────
# macdeployqt copies the Qt frameworks, the platform/style plugins AND
# QtWebEngineProcess.app (the Chromium helper the chart cannot run without)
# into the bundle, then rewrites every install-name to @rpath.
echo "==> Deploying Qt runtime (macdeployqt)..."
"$qt/bin/macdeployqt" "$app" -always-overwrite

# ── signature ───────────────────────────────────────────────────────────────
# macdeployqt rewrites Mach-O load commands, which invalidates whatever
# signature the copied frameworks arrived with. On Apple Silicon an invalid
# signature is fatal — the loader kills the process — so signing is not
# optional here even for a purely local build. Ad-hoc ("-") satisfies that
# without a certificate; it does NOT make the app distributable.
sign_id="${PM_SIGN_ID:--}"
echo "==> Signing (identity: $sign_id)..."
if [[ "$sign_id" == "-" ]]; then
    codesign --force --deep --sign - "$app"
else
    # A real identity gets the hardened runtime + the QtWebEngine entitlements,
    # which is what notarisation requires.
    codesign --force --deep --options runtime --timestamp \
             --entitlements "$src/resources/terminal.entitlements" \
             --sign "$sign_id" "$app"
fi
codesign --verify --deep --strict "$app" \
    && echo "    signature OK" \
    || die "signature verification failed"

echo
echo "==> Done: $app"
echo "    Run it:      open '$app'"
echo "    Package it:  ./package-macos.sh"
