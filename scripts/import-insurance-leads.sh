#!/usr/bin/env bash
# Pull insurance household records from origin/insurance and import into Convex.
#
# INSURANCE_DATA_SCOPE (default: merged):
#   merged    — all insurance household JSON files, deduped (~5.5k unique)
#   citywide  — household_demo_citywide.json (~2k, spread across SF)
#   full      — household_records.json (~2k top composite leads)
#   demo      — household_demo_records.json (legacy demo spread)
#   file      — single file via INSURANCE_DATA_FILE=my.json
#
# Rows are deduped by household_id (highest composite_score wins) before import.
# Uses --replace so Convex leads table has no stale or duplicate households.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOPE="${INSURANCE_DATA_SCOPE:-merged}"
OUT_JSONL="${ROOT}/convex/seed/insurance_leads.jsonl"
CACHE_DIR="${ROOT}/.cache/insurance-import"

mkdir -p "$CACHE_DIR"
echo "Fetching origin/insurance..."
git -C "$ROOT" fetch origin insurance 2>/dev/null || true

python3 << PY
import json
import subprocess
from pathlib import Path

ROOT = Path("${ROOT}")
CACHE = Path("${CACHE_DIR}")
SCOPE = "${SCOPE}"
OUT = Path("${OUT_JSONL}")

INSURANCE_HOUSEHOLD_FILES = [
    "household_demo_citywide.json",
    "household_records.json",
    "household_demo_records.json",
]

def git_show(path: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(ROOT), "show", f"origin/insurance:{path}"])

def load_json(path: str) -> list:
    cache_path = CACHE / path.replace("/", "__")
    if not cache_path.exists():
        cache_path.write_bytes(git_show(path))
    with cache_path.open() as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise SystemExit(f"Expected JSON array in {path}")
    return data

SCOPE_FILES = {
    "merged": INSURANCE_HOUSEHOLD_FILES,
    "citywide": ["household_demo_citywide.json"],
    "full": ["household_records.json"],
    "demo": ["household_demo_records.json"],
}

if SCOPE == "file":
    single = "${INSURANCE_DATA_FILE:-}"
    if not single:
        raise SystemExit("INSURANCE_DATA_SCOPE=file requires INSURANCE_DATA_FILE")
    sources = [single]
elif SCOPE in SCOPE_FILES:
    sources = SCOPE_FILES[SCOPE]
else:
    raise SystemExit(f"Unknown INSURANCE_DATA_SCOPE={SCOPE}")

REQUIRED_KEYS = {
    "household_id",
    "address",
    "lat",
    "lng",
    "neighborhood",
    "composite_score",
    "need_score",
    "timing_score",
}

def row_to_doc(row: dict, sprite_variant: int) -> dict:
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
        "spriteVariant": sprite_variant,
    }
    if row.get("year_built") is not None:
        doc["yearBuilt"] = row["year_built"]
    if row.get("purchase_year") is not None:
        doc["purchaseYear"] = row["purchase_year"]
    if row.get("years_owned") is not None:
        doc["yearsOwned"] = row["years_owned"]
    return doc

merged: dict[str, tuple[dict, str]] = {}
source_dupes = 0
skipped_non_insurance = 0

for source in sources:
    rows = load_json(source)
    for row in rows:
        hid = row.get("household_id")
        if not hid:
            skipped_non_insurance += 1
            continue
        if not REQUIRED_KEYS.issubset(row.keys()):
            skipped_non_insurance += 1
            continue
        score = float(row.get("composite_score") or 0)
        prev = merged.get(hid)
        if prev is not None:
            source_dupes += 1
            if score <= float(prev[0].get("composite_score") or 0):
                continue
        merged[hid] = (row, source)

if not merged:
    raise SystemExit("No insurance household rows found — check INSURANCE_DATA_SCOPE / origin/insurance")

records = sorted(
    merged.values(),
    key=lambda item: float(item[0].get("composite_score") or 0),
    reverse=True,
)

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w") as f:
    for i, (row, _source) in enumerate(records):
        f.write(json.dumps(row_to_doc(row, i % 4), separators=(",", ":")) + "\\n")

print(
    f"Scope={SCOPE} sources={sources} "
    f"skipped_non_insurance={skipped_non_insurance} "
    f"source_dupes_dropped={source_dupes} "
    f"unique={len(records)} -> {OUT}"
)
PY

echo "Importing into Convex (replace leads table, deduped by householdId)..."
cd "$ROOT"
npx convex import --table leads --replace -y "$OUT_JSONL"

echo "Done."
