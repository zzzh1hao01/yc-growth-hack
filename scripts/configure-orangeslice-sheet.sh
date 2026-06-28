#!/usr/bin/env bash
# Configure Orange Slice ↔ HouseholdIQ HTTP integration in Convex.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHEET_URL="${1:-}"
SITE_URL="${NEXT_PUBLIC_CONVEX_SITE_URL:-https://watchful-condor-23.convex.site}"

if [[ -z "$SHEET_URL" ]]; then
  echo "Usage: $0 <orange-slice-sheet-url>"
  echo ""
  echo "Example:"
  echo "  $0 'https://app.orangeslice.ai/s/abc123'"
  exit 1
fi

SECRET="$(openssl rand -hex 24)"

cd "$ROOT"
echo "Setting Convex env..."
npx convex env set OUTREACH_WEBHOOK_SECRET "$SECRET"
npx convex env set ORANGE_SLICE_SHEET_URL "$SHEET_URL"

echo ""
echo "Done. Save this secret for Orange Slice column auth:"
echo "  OUTREACH_WEBHOOK_SECRET=$SECRET"
echo ""
echo "Endpoints for your Orange Slice sheet:"
echo "  Import: GET  $SITE_URL/orangeslice/import?limit=25"
echo "  Status: POST $SITE_URL/orangeslice/status"
echo ""
echo "Header: Authorization: Bearer $SECRET"
echo ""
echo "Sheet template + chat prompt:"
echo "  docs/ORANGE_SLICE_SHEET_TEMPLATE.md"
echo "  docs/ORANGE_SLICE_CHAT_PROMPT.txt"
