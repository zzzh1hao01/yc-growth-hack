import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import seedData from "./seed/household_sample.json";

type InsuranceRecord = {
  household_id: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood: string;
  year_built?: number | null;
  sqft: number;
  owner_occupied: boolean;
  replacement_cost_today: number;
  coverage_anchor: number;
  replacement_cost_gap_dollars: number;
  replacement_cost_gap_pct: number;
  need_score: number;
  timing_score: number;
  timing_confidence: "high" | "low" | "none";
  composite_score: number;
  worth_outreach: boolean;
  purchase_year?: number | null;
  years_owned?: number | null;
};

function householdDoc(row: InsuranceRecord, spriteVariant: number) {
  return {
    householdId: row.household_id,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    neighborhood: row.neighborhood,
    sqft: row.sqft,
    ownerOccupied: row.owner_occupied,
    replacementCostToday: row.replacement_cost_today,
    coverageAnchor: row.coverage_anchor,
    replacementCostGapDollars: row.replacement_cost_gap_dollars,
    replacementCostGapPct: row.replacement_cost_gap_pct,
    needScore: row.need_score,
    timingScore: row.timing_score,
    timingConfidence: row.timing_confidence,
    compositeScore: row.composite_score,
    worthOutreach: row.worth_outreach,
    spriteVariant,
    ...(row.year_built != null ? { yearBuilt: row.year_built } : {}),
    ...(row.purchase_year != null ? { purchaseYear: row.purchase_year } : {}),
    ...(row.years_owned != null ? { yearsOwned: row.years_owned } : {}),
  };
}

export const seedFromSample = mutation({
  args: {
    replace: v.optional(v.boolean()),
    householdsJson: v.optional(v.string()),
  },
  handler: async (ctx, { replace, householdsJson }) => {
    if (replace) {
      const existing = await ctx.db.query("leads").collect();
      for (const doc of existing) {
        await ctx.db.delete(doc._id);
      }
    }

    const records = householdsJson
      ? (JSON.parse(householdsJson) as InsuranceRecord[])
      : (seedData as InsuranceRecord[]);

    let inserted = 0;
    let updated = 0;

    for (const [index, row] of records.entries()) {
      const doc = householdDoc(row, index % 4);

      const existing = await ctx.db
        .query("leads")
        .withIndex("by_household_id", (q) => q.eq("householdId", doc.householdId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, doc);
        updated += 1;
      } else {
        await ctx.db.insert("leads", doc);
        inserted += 1;
      }
    }

    return { inserted, updated, total: records.length };
  },
});

export const patchRecordedOwner = internalMutation({
  args: {
    leadId: v.id("leads"),
    recordedOwnerFullName: v.string(),
    recordedOwnerSource: v.string(),
    ownerFirstName: v.optional(v.string()),
    ownerLastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fullName = args.recordedOwnerFullName.trim();
    await ctx.db.patch(args.leadId, {
      recordedOwnerFullName: fullName,
      recordedOwnerSource: args.recordedOwnerSource,
      ownerFullName: fullName,
      ...(args.ownerFirstName ? { ownerFirstName: args.ownerFirstName } : {}),
      ...(args.ownerLastName ? { ownerLastName: args.ownerLastName } : {}),
      ownerNameSource: args.recordedOwnerSource,
      ownerContactRole: "owner",
    });
  },
});
