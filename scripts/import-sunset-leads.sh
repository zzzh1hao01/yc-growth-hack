#!/usr/bin/env bash
# Pull sunset_parkside_records.json from origin/backend/issues and import into Convex.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_JSON="${ROOT}/.cache/sunset_parkside_records.json"
OUT_JSONL="${ROOT}/convex/seed/sunset_parkside_leads.jsonl"

mkdir -p "${ROOT}/.cache"
echo "Fetching sunset_parkside_records.json from origin/backend/issues..."
git -C "$ROOT" show origin/backend/issues:sunset_parkside_records.json > "$SRC_JSON"

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
            "yearBuilt": row["year_built"] if row.get("year_built") is not None else 0,
            "ownerOccupied": row["owner_occupied"],
            "assessedValue": row["assessed_value"] if row.get("assessed_value") is not None else 0,
            "clusterId": row["cluster_id"],
            "verticalScores": row["vertical_scores"],
            "spriteVariant": i % 4,
        }
        if row.get("last_sale_date"):
            doc["lastSaleDate"] = row["last_sale_date"]
        for key, out_key in [
            ("recorded_owner_full_name", "recordedOwnerFullName"),
            ("recorded_owner_source", "recordedOwnerSource"),
            ("owner_first_name", "ownerFirstName"),
            ("owner_last_name", "ownerLastName"),
            ("owner_full_name", "ownerFullName"),
            ("assessor_block", "assessorBlock"),
            ("assessor_lot", "assessorLot"),
            ("parcel_number", "parcelNumber"),
        ]:
            if row.get(key):
                doc[out_key] = row[key]
        f.write(json.dumps(doc, separators=(",", ":")) + "\\n")

print(f"Prepared {len(data)} leads -> {out}")
PY

echo "Importing into Convex (replaces leads table)..."
cd "$ROOT"
npx convex import --table leads --replace -y "$OUT_JSONL"

echo "Done."
