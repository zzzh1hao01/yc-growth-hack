"""
Merge insurance-scored records (with ACS) into the existing per-neighborhood
household records (which carry vertical_scores from the contractor pipeline).

Input:
  household_records_acs.json  — top-2000 insurance leads with ACS fields
  data/<neighborhood>_records.json — per-neighborhood records with vertical_scores

Output:
  household_records_merged.json — combined records with both insurance and
                                   vertical_scores fields

Join key: household_id (block-lot, e.g. "3601-1")
"""
import glob
import json
import sys
from pathlib import Path


def load_vertical_index() -> dict:
    """Build household_id → record dict from all per-neighborhood files."""
    idx: dict = {}
    pattern = Path("data") / "*_records.json"
    files = sorted(glob.glob(str(pattern)))
    if not files:
        # Try relative to script location
        pattern = Path(__file__).parent.parent / "data" / "*_records.json"
        files = sorted(glob.glob(str(pattern)))
    for path in files:
        records = json.loads(Path(path).read_text())
        for r in records:
            hid = r.get("household_id")
            if hid:
                idx[hid] = r
        print(f"  loaded {len(records):>6} records from {Path(path).name}")
    print(f"  total index: {len(idx)} unique households")
    return idx


def merge(insurance_path: str, out_path: str) -> None:
    ins_records = json.loads(Path(insurance_path).read_text())
    print(f"Insurance records: {len(ins_records)}")

    print("\nLoading existing vertical records...")
    vert_idx = load_vertical_index()

    merged = []
    matched = 0
    for r in ins_records:
        hid = r["household_id"]
        existing = vert_idx.get(hid, {})
        row = {**r}
        # Carry over vertical_scores and cluster_id from the contractor pipeline
        if existing.get("vertical_scores"):
            row["vertical_scores"] = existing["vertical_scores"]
            matched += 1
        if existing.get("cluster_id") is not None:
            row["cluster_id"] = existing["cluster_id"]
        # Fill assessed_value from existing if present
        if existing.get("assessed_value") and "assessed_value" not in row:
            row["assessed_value"] = existing["assessed_value"]
        merged.append(row)

    Path(out_path).write_text(json.dumps(merged, indent=2))
    print(f"\nMerged {len(merged)} records → {out_path}")
    print(f"  {matched}/{len(merged)} had matching vertical_scores")
    print(f"  {len(merged) - matched}/{len(merged)} insurance-only (no vertical match)")

    # Summary of ACS fields present
    with_acs = sum(1 for r in merged if r.get("archetype"))
    worth = sum(1 for r in merged if r.get("worth_outreach"))
    print(f"  {with_acs}/{len(merged)} have ACS archetype")
    print(f"  {worth}/{len(merged)} worth_outreach (composite >= 0.70)")

    if with_acs:
        from collections import Counter
        arches = Counter(r.get("archetype") for r in merged if r.get("archetype"))
        print("\nArchetype breakdown in leads:")
        for k, v in arches.most_common():
            print(f"  {k:<22} {v:>4}  ({v/with_acs*100:.0f}%)")


if __name__ == "__main__":
    ins_path = sys.argv[1] if len(sys.argv) > 1 else "household_records_acs.json"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "household_records_merged.json"
    merge(ins_path, out_path)
