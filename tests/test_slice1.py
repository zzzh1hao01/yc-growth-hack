"""
Slice 1: Data exploration — SF building permits + Assessor parcel data.
Tests verify that the data is accessible and structured as expected.
All tests hit live APIs; mark slow with -m slow if needed.
"""
import pytest
from explore.permits import fetch_permit_sample, PERMIT_REQUIRED_FIELDS


# ---------------------------------------------------------------------------
# Cycle 1 — Tracer bullet: API reachable, schema confirmed
# ---------------------------------------------------------------------------

def test_permits_api_reachable_and_returns_records():
    records = fetch_permit_sample(limit=5)
    assert len(records) > 0, "Expected permit records from SF Open Data API"


def test_permits_have_required_fields():
    records = fetch_permit_sample(limit=5)
    first = records[0]
    missing = [f for f in PERMIT_REQUIRED_FIELDS if f not in first]
    assert not missing, f"Missing expected fields: {missing}"


# ---------------------------------------------------------------------------
# Cycle 2 — HVAC permit codes enumerable
# ---------------------------------------------------------------------------

from explore.permits import find_hvac_permit_types


def test_hvac_permit_types_found():
    codes = find_hvac_permit_types()
    assert len(codes) > 0, "Expected to find HVAC-related permit descriptions"


def test_hvac_permit_types_are_strings():
    codes = find_hvac_permit_types()
    assert all(isinstance(c, str) and c.strip() for c in codes)


# ---------------------------------------------------------------------------
# Cycle 3 — Electrical permit codes enumerable (panel upgrades + EV chargers)
# ---------------------------------------------------------------------------

from explore.permits import find_electrical_permit_types


def test_electrical_panel_permits_found():
    codes = find_electrical_permit_types(vertical="panel")
    assert len(codes) > 0, "Expected panel upgrade permit descriptions"


def test_electrical_ev_charger_permits_found():
    codes = find_electrical_permit_types(vertical="ev")
    assert len(codes) > 0, "Expected EV charger permit descriptions"


def test_electrical_permit_types_are_strings():
    codes = find_electrical_permit_types(vertical="panel") + find_electrical_permit_types(vertical="ev")
    assert all(isinstance(c, str) and c.strip() for c in codes)


# ---------------------------------------------------------------------------
# Cycle 4 — Assessor data accessible + has_pool flag check
# ---------------------------------------------------------------------------

from explore.assessor import fetch_assessor_sample, ASSESSOR_REQUIRED_FIELDS, count_pool_parcels


def test_assessor_api_reachable():
    records = fetch_assessor_sample(limit=5)
    assert len(records) > 0, "Expected assessor records from SF Open Data"


def test_assessor_has_required_fields():
    records = fetch_assessor_sample(limit=5)
    first = records[0]
    missing = [f for f in ASSESSOR_REQUIRED_FIELDS if f not in first]
    assert not missing, f"Missing assessor fields: {missing}"


def test_pool_parcel_count_is_int():
    count = count_pool_parcels()
    assert isinstance(count, int), "Pool parcel count should be an integer"


# ---------------------------------------------------------------------------
# Cycle 5 — Address join rate computable
# ---------------------------------------------------------------------------

from explore.analysis import compute_join_rate


def test_join_rate_is_float_between_0_and_1():
    rate = compute_join_rate(sample_size=200)
    assert isinstance(rate, float), "Join rate should be a float"
    assert 0.0 <= rate <= 1.0, f"Join rate out of range: {rate}"


def test_join_rate_is_nonzero():
    rate = compute_join_rate(sample_size=200)
    assert rate > 0.0, "Expected some permit addresses to match parcels"


# ---------------------------------------------------------------------------
# Cycle 6 — Neighborhood permit density rankable
# ---------------------------------------------------------------------------

from explore.analysis import rank_neighborhoods_by_permit_density


def test_neighborhood_ranking_returns_list():
    ranked = rank_neighborhoods_by_permit_density(top_n=5)
    assert isinstance(ranked, list), "Expected a list of neighborhoods"


def test_neighborhood_ranking_has_expected_keys():
    ranked = rank_neighborhoods_by_permit_density(top_n=5)
    assert len(ranked) > 0, "Expected at least one neighborhood"
    first = ranked[0]
    assert "neighborhood" in first
    assert "permit_count" in first


def test_neighborhood_ranking_is_descending():
    ranked = rank_neighborhoods_by_permit_density(top_n=5)
    counts = [r["permit_count"] for r in ranked]
    assert counts == sorted(counts, reverse=True), "Rankings should be in descending order"
