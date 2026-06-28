#!/usr/bin/env python3
"""
Join SF Assessor secured roll (with owner names) onto household ETL rows by block/lot.

The public DataSF SODA API (wv5m-vpq2) does NOT include owner names (CA privacy law).
Obtain a roll with owner fields from SF Assessor-Recorder:
  https://www.sf.gov/resource--secured-property-tax-data
  (in-office access or data request form — owner/mailing columns included)

Usage:
  python scripts/join_assessor_owners.py \\
    --households convex/seed/household_sample.json \\
    --assessor data/assessor_owners.csv \\
    --output convex/seed/household_sample.json

CSV must include block + lot + owner name. Supported header aliases (case-insensitive):
  block, lot, owner_name / owner / name / taxpayer_name / owner1
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path


def normalize_header(h: str) -> str:
    return re.sub(r"[^a-z0-9]", "", h.strip().lower())


BLOCK_KEYS = {"block", "blk", "blocknumber", "blocknum"}
LOT_KEYS = {"lot", "lotnumber", "lotnum"}
OWNER_KEYS = {
    "ownername",
    "owner",
    "name",
    "taxpayername",
    "owner1",
    "primaryowner",
    "ownerfullname",
    "assesseename",
}


def pad_lot(lot: str) -> str:
    cleaned = lot.strip().upper()
    if cleaned.isdigit():
        return cleaned.zfill(3)
    return cleaned


def parse_household_id(household_id: str) -> tuple[str, str] | None:
    trimmed = household_id.strip()
    dash = trimmed.rfind("-")
    if dash <= 0:
        return None
    block = trimmed[:dash].strip().upper()
    lot = pad_lot(trimmed[dash + 1 :])
    return block, lot


def pick_column(fieldnames: list[str], candidates: set[str]) -> str | None:
    for raw in fieldnames:
        if normalize_header(raw) in candidates:
            return raw
    return None


def load_assessor_index(path: Path) -> dict[tuple[str, str], str]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError(f"No headers in {path}")

        block_col = pick_column(reader.fieldnames, BLOCK_KEYS)
        lot_col = pick_column(reader.fieldnames, LOT_KEYS)
        owner_col = pick_column(reader.fieldnames, OWNER_KEYS)

        if not block_col or not lot_col or not owner_col:
            raise ValueError(
                f"Could not find block/lot/owner columns in {path}. "
                f"Headers: {reader.fieldnames}"
            )

        index: dict[tuple[str, str], str] = {}
        dupes = 0
        for row in reader:
            block = str(row.get(block_col, "")).strip().upper()
            lot = pad_lot(str(row.get(lot_col, "")))
            owner = str(row.get(owner_col, "")).strip()
            if not block or not lot or not owner:
                continue
            key = (block, lot)
            if key in index and index[key] != owner:
                dupes += 1
            index[key] = owner

        if dupes:
            print(f"Warning: {dupes} duplicate block/lot keys — last row wins", file=sys.stderr)

        return index


def clean_owner_name(name: str) -> str:
    cleaned = re.sub(r"\s+", " ", name.strip())
    # Drop common trust/LLC suffix noise for display contact name when no person parseable
    return cleaned


def split_owner_name(full: str) -> tuple[str | None, str | None]:
    cleaned = clean_owner_name(full)
    if not cleaned:
        return None, None
    upper = cleaned.upper()
    if any(token in upper for token in (" LLC", " TRUST", " INC", " CORP", " LP")):
        return None, None
    parts = cleaned.split()
    if len(parts) < 2:
        return None, None
    return parts[0], " ".join(parts[1:])


def join_households(households: list[dict], index: dict[tuple[str, str], str]) -> tuple[list[dict], int]:
    matched = 0
    out: list[dict] = []

    for row in households:
        doc = dict(row)
        hid = doc.get("household_id") or doc.get("householdId")
        if not hid:
            out.append(doc)
            continue

        parsed = parse_household_id(str(hid))
        if not parsed:
            out.append(doc)
            continue

        owner = index.get(parsed)
        if not owner:
            out.append(doc)
            continue

        matched += 1
        full = clean_owner_name(owner)
        doc["recorded_owner_full_name"] = full
        doc["recorded_owner_source"] = "assessor"
        first, last = split_owner_name(full)
        if first and last:
            doc["owner_first_name"] = first
            doc["owner_last_name"] = last
            doc["owner_full_name"] = full
        block, lot = parsed
        doc["assessor_block"] = block
        doc["assessor_lot"] = lot

        out.append(doc)

    return out, matched


def main() -> None:
    parser = argparse.ArgumentParser(description="Join assessor owner names onto household JSON")
    parser.add_argument("--households", type=Path, required=True)
    parser.add_argument("--assessor", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    households = json.loads(args.households.read_text())
    if not isinstance(households, list):
        raise SystemExit("Households file must be a JSON array")

    index = load_assessor_index(args.assessor)
    enriched, matched = join_households(households, index)

    args.output.write_text(json.dumps(enriched, indent=2) + "\n")
    print(
        f"Joined {matched}/{len(households)} households with assessor owners "
        f"({len(index)} parcels in roll) -> {args.output}"
    )


if __name__ == "__main__":
    main()
