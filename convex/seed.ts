import { v } from "convex/values";
import { mutation } from "./_generated/server";

type HouseholdRecord = {
  household_id: string;
  address: string;
  lat: number;
  lng: number;
  year_built: number;
  owner_occupied: boolean;
  assessed_value: number;
  last_sale_date?: string;
  cluster_id: number;
  vertical_scores: unknown;
};

// Bundled at deploy time from convex/seed/household_sample.json
import seedData from "./seed/household_sample.json";

export const seedFromSample = mutation({
  args: { replace: v.optional(v.boolean()) },
  handler: async (ctx, { replace }) => {
    if (replace) {
      const existing = await ctx.db.query("leads").collect();
      for (const doc of existing) {
        await ctx.db.delete(doc._id);
      }
    }

    const records = seedData as HouseholdRecord[];
    const households = records.map((row, index) => ({
      householdId: row.household_id,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      yearBuilt: row.year_built ?? 0,
      ownerOccupied: row.owner_occupied,
      assessedValue: row.assessed_value ?? 0,
      ...(row.last_sale_date ? { lastSaleDate: row.last_sale_date } : {}),
      clusterId: row.cluster_id,
      verticalScores: row.vertical_scores,
      spriteVariant: index % 4,
    }));

    let inserted = 0;
    let updated = 0;

    for (const row of households) {
      const existing = await ctx.db
        .query("leads")
        .withIndex("by_household_id", (q) => q.eq("householdId", row.householdId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, row);
        updated += 1;
      } else {
        await ctx.db.insert("leads", row);
        inserted += 1;
      }
    }

    return { inserted, updated, total: households.length };
  },
});
