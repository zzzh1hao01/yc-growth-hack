#!/usr/bin/env bash
# Enable auto-push on Pursue — POST leads to Orange Slice Import-from-webhook URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEBHOOK_URL="${1:-}"
SITE_URL="${NEXT_PUBLIC_CONVEX_SITE_URL:-https://compassionate-ptarmigan-622.convex.site}"

if [[ -z "$WEBHOOK_URL" ]]; then
  echo "Usage: $0 <orange-slice-import-webhook-url>"
  echo ""
  echo "Get the URL from Orange Slice → your sheet → Import from webhook column."
  echo ""
  echo "Example:"
  echo "  $0 'https://....'"
  exit 1
fi

cd "$ROOT"
echo "Setting Convex env ORANGE_SLICE_SHEET_WEBHOOK_URL..."
npx convex env set ORANGE_SLICE_SHEET_WEBHOOK_URL "$WEBHOOK_URL"

SECRET="$(npx convex env get OUTREACH_WEBHOOK_SECRET 2>/dev/null | tail -1 || true)"
if [[ -n "$SECRET" && "$SECRET" != OUTREACH_WEBHOOK_SECRET=* ]]; then
  echo ""
  echo "Also storing in Convex DB (backup) via configure endpoint..."
  curl -s -X POST "$SITE_URL/orangeslice/configure-webhook" \
    -H "Authorization: Bearer $SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"webhook_url\":\"$WEBHOOK_URL\"}" || true
  echo ""
fi

echo ""
echo "Done. Pursue will now auto-push rows to Orange Slice."
echo "Test: pursue a lead in the app, then check your sheet."
