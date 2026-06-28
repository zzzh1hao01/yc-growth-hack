#!/usr/bin/env bash
# Join assessor owner names onto household seed, then re-import into Convex.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOUSEHOLDS="${1:-${ROOT}/convex/seed/household_sample.json}"
ASSESSOR_CSV="${ASSESSOR_OWNERS_CSV:-${ROOT}/data/assessor_owners.csv}"
OUTPUT="${ROOT}/convex/seed/household_sample_enriched.json"

if [[ ! -f "$ASSESSOR_CSV" ]]; then
  echo "Missing assessor owner file: $ASSESSOR_CSV"
  echo ""
  echo "SF Assessor does not publish owner names on the public DataSF API."
  echo "Get the secured roll with owner fields (free in-office or via data request):"
  echo "  https://www.sf.gov/resource--secured-property-tax-data"
  echo ""
  echo "Save as data/assessor_owners.csv with columns: block, lot, owner_name"
  echo "See data/assessor_owners.example.csv for format."
  exit 1
fi

python3 "${ROOT}/scripts/join_assessor_owners.py" \
  --households "$HOUSEHOLDS" \
  --assessor "$ASSESSOR_CSV" \
  --output "$OUTPUT"

echo "Re-seeding Convex from enriched households..."
cd "$ROOT"
JSON_PAYLOAD=$(python3 - <<PY
import json
from pathlib import Path
data = Path("${OUTPUT}").read_text()
print(json.dumps({"replace": True, "householdsJson": data}))
PY
)
npx convex run seed:seedFromSample "$JSON_PAYLOAD"

echo "Done. Owner names loaded from assessor roll."
