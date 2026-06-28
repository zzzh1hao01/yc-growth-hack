/**
 * SF Assessor Historical Secured Property Tax Rolls (DataSF / SODA).
 * https://data.sfgov.org/resource/wv5m-vpq2.json
 *
 * Note: California law prohibits publishing owner names on the public online roll.
 * This module resolves parcel/APN, property class, year built, and owner-occupied signals.
 */

const ASSESSOR_RESOURCE = "https://data.sfgov.org/resource/wv5m-vpq2.json";

export type AssessorParcel = {
  block: string;
  lot: string;
  parcelNumber: string;
  propertyLocation: string;
  yearBuilt?: number;
  useDefinition?: string;
  propertyClassCode?: string;
  propertyClassDefinition?: string;
  homeownerExemption: boolean;
  assessedLand?: number;
  assessedImprovement?: number;
  neighborhood?: string;
  rollYear: string;
};

type AssessorRow = {
  closed_roll_year?: string;
  property_location?: string;
  parcel_number?: string;
  block?: string;
  lot?: string;
  year_property_built?: string;
  use_definition?: string;
  property_class_code?: string;
  property_class_code_definition?: string;
  homeowner_exemption_value?: string;
  exemption_code_definition?: string;
  assessed_land_value?: string;
  assessed_improvement_value?: string;
  assessor_neighborhood?: string;
};

export function parseBlockLot(householdId: string): { block: string; lot: string } | null {
  const trimmed = householdId.trim();
  const dash = trimmed.lastIndexOf("-");
  if (dash <= 0) return null;

  const block = trimmed.slice(0, dash).trim();
  const lotRaw = trimmed.slice(dash + 1).trim();
  if (!block || !lotRaw) return null;

  const lot = lotRaw.padStart(3, "0");
  return { block, lot };
}

function toNumber(value: string | undefined): number | undefined {
  if (value == null || value === "" || value === "NA") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function rowToParcel(row: AssessorRow): AssessorParcel {
  const homeownerExemption =
    toNumber(row.homeowner_exemption_value) !== undefined &&
    (toNumber(row.homeowner_exemption_value) ?? 0) > 0;

  return {
    block: row.block ?? "",
    lot: row.lot ?? "",
    parcelNumber: row.parcel_number ?? "",
    propertyLocation: row.property_location ?? "",
    yearBuilt: toNumber(row.year_property_built),
    useDefinition: row.use_definition,
    propertyClassCode: row.property_class_code,
    propertyClassDefinition: row.property_class_code_definition,
    homeownerExemption:
      homeownerExemption ||
      (row.exemption_code_definition?.toLowerCase().includes("home owner") ?? false),
    assessedLand: toNumber(row.assessed_land_value),
    assessedImprovement: toNumber(row.assessed_improvement_value),
    neighborhood: row.assessor_neighborhood,
    rollYear: row.closed_roll_year ?? "",
  };
}

export async function fetchAssessorParcelByBlockLot(
  block: string,
  lot: string,
): Promise<AssessorParcel | null> {
  const params = new URLSearchParams({
    block,
    lot,
    "$order": "closed_roll_year DESC",
    "$limit": "1",
  });

  const res = await fetch(`${ASSESSOR_RESOURCE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`DataSF assessor lookup failed (${res.status})`);
  }

  const rows = (await res.json()) as AssessorRow[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rowToParcel(rows[0]);
}

export async function fetchAssessorParcelByHouseholdId(
  householdId: string,
): Promise<AssessorParcel | null> {
  const parsed = parseBlockLot(householdId);
  if (!parsed) return null;
  return fetchAssessorParcelByBlockLot(parsed.block, parsed.lot);
}

export function assessorEvidenceText(parcel: AssessorParcel): string {
  return [
    `Assessor block ${parcel.block} lot ${parcel.lot} (APN ${parcel.parcelNumber})`,
    parcel.propertyLocation ? `Roll address: ${parcel.propertyLocation}` : null,
    parcel.useDefinition ? `Use: ${parcel.useDefinition}` : null,
    parcel.propertyClassDefinition ? `Class: ${parcel.propertyClassDefinition}` : null,
    parcel.yearBuilt ? `Year built (assessor): ${parcel.yearBuilt}` : null,
    parcel.homeownerExemption ? "Homeowner exemption on file (likely owner-occupied)" : null,
    parcel.neighborhood ? `Neighborhood: ${parcel.neighborhood}` : null,
    `Roll year: ${parcel.rollYear}`,
  ]
    .filter(Boolean)
    .join("\n");
}
