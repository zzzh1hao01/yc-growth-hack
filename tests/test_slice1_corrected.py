"""
Slice 1 CORRECTION tests — correctness, not just shape.

The original test_slice1.py asserts shape (is it a float 0-1, is the list
descending) and would NOT have caught the wrong-dataset bug (querying only
building permits, undercounting electrical ~195x). These tests assert against
known-true facts: the right dataset per vertical, sane order-of-magnitude
counts, and a real block/lot join rate.

All tests hit live SF Open Data. The join test is marked slow.
"""
import pytest

from explore.sources import VERTICAL_FILTERS, count_records
from explore.analysis import validate_block_lot_join


# ---------------------------------------------------------------------------
# Correct dataset per vertical (the Slice 1 mistake was dataset choice)
# ---------------------------------------------------------------------------

def test_panel_and_ev_come_from_electrical_dataset():
    assert VERTICAL_FILTERS["panel"]["dataset"] == "electrical"
    assert VERTICAL_FILTERS["ev"]["dataset"] == "electrical"


def test_hvac_comes_from_plumbing_dataset():
    # SF files mechanical/HVAC work under "plumbing", not building permits.
    assert VERTICAL_FILTERS["hvac"]["dataset"] == "plumbing"


# ---------------------------------------------------------------------------
# Sane order-of-magnitude counts — would FAIL on the old 366 panel / 135 EV
# ---------------------------------------------------------------------------

def test_panel_count_is_dense_not_hundreds():
    n = count_records("electrical", VERTICAL_FILTERS["panel"]["where"])
    # Old (wrong) building-permits-only count was 366. Real electrical count is
    # tens of thousands. This floor fails loudly on a regression to that bug.
    assert n > 10_000, f"Panel count {n} too low — electrical dataset likely missed"


def test_electrical_panel_far_exceeds_building_permits_panel():
    electrical = count_records("electrical", VERTICAL_FILTERS["panel"]["where"])
    building = count_records(
        "building",
        "upper(description) like '%PANEL UPGRADE%' OR upper(description) like '%SERVICE UPGRADE%'",
    )
    # The whole point: the signal lives in the electrical dataset, not building.
    assert electrical > building * 20, (
        f"electrical={electrical} not >> building={building}; wrong source?"
    )


def test_ev_count_in_sane_range():
    n = count_records("electrical", VERTICAL_FILTERS["ev"]["where"])
    assert n > 500, f"EV count {n} too low"


def test_hvac_count_in_sane_range():
    n = count_records("plumbing", VERTICAL_FILTERS["hvac"]["where"])
    assert n > 5_000, f"HVAC count {n} too low"


# ---------------------------------------------------------------------------
# The make-or-break: block/lot join actually produces usable records
# ---------------------------------------------------------------------------

@pytest.mark.slow
def test_block_lot_join_rate_is_high():
    result = validate_block_lot_join("panel", permit_sample=300)
    assert 0.0 <= result["join_rate"] <= 1.0
    # block/lot is a true equi-join (both datasets carry the keys); expect the
    # vast majority of permits to match a parcel. Fails loudly if it doesn't.
    assert result["join_rate"] > 0.5, (
        f"block/lot join rate {result['join_rate']:.1%} too low — pipeline may "
        f"not produce usable records: {result}"
    )
    assert result["matched"] > 0
