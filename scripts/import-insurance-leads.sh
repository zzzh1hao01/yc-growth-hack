#!/usr/bin/env bash
# Pull insurance household records from origin/insurance and import into Convex.
# Default source: household_demo_records.json (balanced hot/warm/cold spread for the map).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_FILE="${INSURANCE_DATA_FILE:-household_demo_records.json}"
SRC_JSON="${ROOT}/.cache/${DATA_FILE}"
OUT_JSONL="${ROOT}/convex/seed/insurance_leads.jsonl"

mkdir -p "${ROOT}/.cache"
echo "Fetching ${DATA_FILE} from origin/insurance..."
git -C "$ROOT" fetch origin insurance 2>/dev/null || true
git -C "$ROOT" show "origin/insurance:${DATA_FILE}" > "$SRC_JSON"

python3 << PY
import json
from pathlib import Path

src = Path("${SRC_JSON}")
out = Path("${OUT_JSONL}")
with src.open() as f:
    data = json.load(f)

with out.open("w") as f:
    for i, row in enumerate(data):
        doc = {
            "householdId": row["household_id"],
            "address": row["address"],
            "lat": row["lat"],
            "lng": row["lng"],
            "neighborhood": row["neighborhood"],
            "sqft": row["sqft"],
            "ownerOccupied": row["owner_occupied"],
            "replacementCostToday": row["replacement_cost_today"],
            "coverageAnchor": row["coverage_anchor"],
            "replacementCostGapDollars": row["replacement_cost_gap_dollars"],
            "replacementCostGapPct": row["replacement_cost_gap_pct"],
            "needScore": row["need_score"],
            "timingScore": row["timing_score"],
            "timingConfidence": row["timing_confidence"],
            "compositeScore": row["composite_score"],
            "worthOutreach": row["worth_outreach"],
            "spriteVariant": i % 4,
        }
        if row.get("year_built") is not None:
            doc["yearBuilt"] = row["year_built"]
        if row.get("purchase_year") is not None:
            doc["purchaseYear"] = row["purchase_year"]
        if row.get("years_owned") is not None:
            doc["yearsOwned"] = row["years_owned"]
        f.write(json.dumps(doc, separators=(",", ":")) + "\\n")

print(f"Prepared {len(data)} insurance leads -> {out}")
PY

echo "Importing into Convex (replaces leads table)..."
cd "$ROOT"
npx convex import --table leads --replace -y "$OUT_JSONL"

echo "Done."
