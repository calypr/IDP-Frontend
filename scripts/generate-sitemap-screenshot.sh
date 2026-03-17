#!/usr/bin/env bash
# generate-sitemap-screenshot.sh
#
# Regenerates docs/Overview/images/site-map.png from the standalone HTML
# template (docs/Overview/sitemap-template.html) using headless Chromium.
#
# Usage:
#   ./scripts/generate-sitemap-screenshot.sh
#
# Requirements:
#   - chromium, chromium-browser, or google-chrome must be on $PATH
#   - Python 3 must be on $PATH (used for the post-screenshot sanity check)
#
# Optional environment variables:
#   SITE_MAP_TEMPLATE  path to the HTML template  (default: docs/Overview/sitemap-template.html)
#   SITE_MAP_OUTPUT    path for the output PNG     (default: docs/Overview/images/site-map.png)
#   SITE_MAP_WIDTH     viewport width  in CSS px   (default: 1400)
#   SITE_MAP_HEIGHT    viewport height in CSS px   (default: 1000)
#   SITE_MAP_DPR       device pixel ratio          (default: 2, i.e. Retina / 2× quality)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TEMPLATE="${SITE_MAP_TEMPLATE:-${REPO_ROOT}/docs/Overview/sitemap-template.html}"
OUTPUT="${SITE_MAP_OUTPUT:-${REPO_ROOT}/docs/Overview/images/site-map.png}"
VIEWPORT_W="${SITE_MAP_WIDTH:-1400}"
VIEWPORT_H="${SITE_MAP_HEIGHT:-1000}"
DPR="${SITE_MAP_DPR:-2}"

# ── Locate a headless Chromium/Chrome binary ──────────────────────────────────
CHROME=""
for candidate in chromium chromium-browser google-chrome google-chrome-stable; do
  if command -v "$candidate" &>/dev/null; then
    CHROME="$candidate"
    break
  fi
done

if [[ -z "$CHROME" ]]; then
  echo "ERROR: Could not find chromium, chromium-browser, or google-chrome on PATH." >&2
  echo "       Install Chromium/Chrome and retry, or set CHROME=/path/to/chrome." >&2
  exit 1
fi

echo "Using browser: $(command -v "$CHROME")  ($(${CHROME} --version 2>&1 | head -1))"

# ── Verify the template exists ────────────────────────────────────────────────
if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: Template not found: $TEMPLATE" >&2
  exit 1
fi

# ── Encode template as a data: URL so no HTTP server is needed ───────────────
DATA_URL="data:text/html;base64,$(base64 < "$TEMPLATE" | tr -d '\n')"

# ── Ensure output directory exists ───────────────────────────────────────────
mkdir -p "$(dirname "$OUTPUT")"

# ── Take the screenshot ───────────────────────────────────────────────────────
echo "Rendering ${VIEWPORT_W}×${VIEWPORT_H} @ ${DPR}× DPR → $(( VIEWPORT_W * DPR ))×$(( VIEWPORT_H * DPR )) px PNG"

"$CHROME" \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --window-size="${VIEWPORT_W},${VIEWPORT_H}" \
  --force-device-scale-factor="${DPR}" \
  --run-all-compositor-stages-before-draw \
  --screenshot="$OUTPUT" \
  "$DATA_URL" 2>&1 | grep -v -E "dbus|Failed to connect|Failed to call|NameHasOwner|UPower|object_path|SharedImageManager" || true

echo "Screenshot saved: $OUTPUT"

# ── Quick sanity check ────────────────────────────────────────────────────────
if command -v python3 &>/dev/null; then
  python3 - "$OUTPUT" <<'PYEOF'
import struct, os, sys

path = sys.argv[1] if len(sys.argv) > 1 else "docs/Overview/images/site-map.png"
if not os.path.isabs(path):
    path = os.path.join(os.getcwd(), path)
with open(path, "rb") as f:
    f.read(16)          # PNG sig + IHDR length + type
    ihdr = f.read(13)
w = struct.unpack(">I", ihdr[:4])[0]
h = struct.unpack(">I", ihdr[4:8])[0]
size = os.path.getsize(path)
print(f"✅  Verified: {w}×{h} px  ({size // 1024} KB)")
PYEOF
fi
