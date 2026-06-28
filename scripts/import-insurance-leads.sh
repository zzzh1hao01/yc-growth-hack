#!/usr/bin/env bash
# Pull insurance household records from origin/insurance and import into Convex.
#
# INSURANCE_DATA_SCOPE (default: acs-citywide):
#   acs-citywide — household_records_acs_citywide.json (preferred; falls back to merged citywide+ACS)
#   acs          — legacy merge of household_demo_citywide + household_records_acs
#   merged       — all insurance household JSON files, deduped
#   citywide     — household_demo_citywide.json
#   full         — household_records.json
#   demo         — household_demo_records.json
#   file         — single file via INSURANCE_DATA_FILE=my.json
#
# Rows are deduped by household_id (prefer ACS-enriched rows, then higher composite_score).
# Uses --replace so Convex leads table has no stale or duplicate households.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCOPE="${INSURANCE_DATA_SCOPE:-acs-citywide}"
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
    "household_records_acs_citywide.json",
    "household_records_acs.json",
    "household_demo_citywide.json",
    "household_records.json",
    "household_demo_records.json",
]

ACS_CITYWIDE_FILE = "household_records_acs_citywide.json"
ACS_CITYWIDE_FALLBACK = [
    "household_demo_citywide.json",
    "household_records_acs.json",
]

def git_show(path: str) -> bytes | None:
    try:
        return subprocess.check_output(
            ["git", "-C", str(ROOT), "show", f"origin/insurance:{path}"],
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return None

def load_json(path: str) -> list:
    cache_path = CACHE / path.replace("/", "__")
    local_path = ROOT / path
    raw = git_show(path)
    if raw is None and local_path.is_file():
        raw = local_path.read_bytes()
    if raw is None:
        raise FileNotFoundError(path)
    cache_path.write_bytes(raw)
    with cache_path.open() as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise SystemExit(f"Expected JSON array in {path}")
    return data

SCOPE_FILES = {
    "acs-citywide": [ACS_CITYWIDE_FILE],
    "acs": ACS_CITYWIDE_FALLBACK,
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
    sources = list(SCOPE_FILES[SCOPE])
else:
    raise SystemExit(f"Unknown INSURANCE_DATA_SCOPE={SCOPE}")

if SCOPE == "acs-citywide" and git_show(ACS_CITYWIDE_FILE) is None:
    print(
        f"Note: {ACS_CITYWIDE_FILE} not on origin/insurance yet — "
        f"using fallback merge {ACS_CITYWIDE_FALLBACK}",
    )
    sources = ACS_CITYWIDE_FALLBACK

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

ACS_FIELDS = (
    "archetype",
    "acs_receptivity_score",
    "financial_sophistication",
    "inertia_score",
    "coverage_stakes",
)

def acs_richness(row: dict) -> int:
    return sum(1 for key in ACS_FIELDS if row.get(key) is not None)

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
    if row.get("archetype") is not None:
        doc["archetype"] = row["archetype"]
    if row.get("acs_receptivity_score") is not None:
        doc["acsReceptivityScore"] = row["acs_receptivity_score"]
    if row.get("financial_sophistication") is not None:
        doc["financialSophistication"] = row["financial_sophistication"]
    if row.get("inertia_score") is not None:
        doc["inertiaScore"] = row["inertia_score"]
    if row.get("coverage_stakes") is not None:
        doc["coverageStakes"] = row["coverage_stakes"]
    if row.get("recorded_owner_full_name"):
        doc["recordedOwnerFullName"] = row["recorded_owner_full_name"]
    if row.get("recorded_owner_source"):
        doc["recordedOwnerSource"] = row["recorded_owner_source"]
    if row.get("owner_first_name"):
        doc["ownerFirstName"] = row["owner_first_name"]
    if row.get("owner_last_name"):
        doc["ownerLastName"] = row["owner_last_name"]
    if row.get("owner_full_name"):
        doc["ownerFullName"] = row["owner_full_name"]
    if row.get("parcel_number"):
        doc["parcelNumber"] = row["parcel_number"]
    if row.get("assessor_block"):
        doc["assessorBlock"] = row["assessor_block"]
    if row.get("assessor_lot"):
        doc["assessorLot"] = row["assessor_lot"]
    return doc

def should_replace(prev_row: dict, row: dict) -> bool:
    prev_acs = acs_richness(prev_row)
    row_acs = acs_richness(row)
    if row_acs != prev_acs:
        return row_acs > prev_acs
    prev_score = float(prev_row.get("composite_score") or 0)
    row_score = float(row.get("composite_score") or 0)
    return row_score > prev_score

merged: dict[str, tuple[dict, str]] = {}
source_dupes = 0
skipped_non_insurance = 0

for source in sources:
    try:
        rows = load_json(source)
    except FileNotFoundError:
        print(f"Skipping missing source: {source}")
        continue
    for row in rows:
        hid = row.get("household_id")
        if not hid:
            skipped_non_insurance += 1
            continue
        if not REQUIRED_KEYS.issubset(row.keys()):
            skipped_non_insurance += 1
            continue
        prev = merged.get(hid)
        if prev is not None:
            source_dupes += 1
            if not should_replace(prev[0], row):
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

with_acs = sum(1 for row, _ in merged.values() if acs_richness(row) > 0)
neighborhoods = len({row["neighborhood"] for row, _ in merged.values()})
print(
    f"Scope={SCOPE} sources={sources} "
    f"skipped_non_insurance={skipped_non_insurance} "
    f"source_dupes_dropped={source_dupes} "
    f"unique={len(records)} acs_enriched={with_acs} neighborhoods={neighborhoods} -> {OUT}"
)
PY

echo "Importing into Convex (replace leads table, deduped by householdId)..."
cd "$ROOT"
npx convex deploy 2>&1 | tail -5
npx convex import --table leads --replace -y "$OUT_JSONL"

echo "Done."
