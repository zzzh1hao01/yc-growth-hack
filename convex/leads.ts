import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Shared validator — keep in sync with src/types/lead.ts */
const leadFields = {
  address: v.string(),
  lat: v.number(),
  lng: v.number(),
  neighborhood: v.optional(v.string()),
  matchScore: v.number(),
  urgent: v.boolean(),
  spriteVariant: v.number(),
  permitAgeYears: v.number(),
  lastPermitType: v.optional(v.string()),
  lastPermitDate: v.optional(v.string()),
  hasOpenPermit: v.optional(v.boolean()),
  homeAgeYears: v.number(),
  ownerOccupied: v.optional(v.boolean()),
  assessedValue: v.optional(v.number()),
  lastSaleDate: v.optional(v.string()),
  clusterId: v.optional(v.string()),
  cluster: v.string(),
  distanceMiles: v.optional(v.number()),
  vertical: v.optional(v.union(v.literal("hvac"), v.literal("electrical"))),
  dataSource: v.optional(
    v.union(v.literal("placeholder"), v.literal("etl")),
  ),
  externalId: v.string(),
};

/**
 * List all leads for the bounty board, highest match first.
 * Wire to UI: useQuery(api.leads.listLeads) in QuestBoard.tsx
 */
export const listLeads = query({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_match_score")
      .order("desc")
      .collect();

    return leads
      .filter((lead) => lead.hasOpenPermit !== true)
      .map((doc) => ({
        id: doc.externalId,
        address: doc.address,
        lat: doc.lat,
        lng: doc.lng,
        neighborhood: doc.neighborhood,
        matchScore: doc.matchScore,
        urgent: doc.urgent,
        spriteVariant: doc.spriteVariant as 0 | 1 | 2 | 3,
        permitAgeYears: doc.permitAgeYears,
        lastPermitType: doc.lastPermitType,
        lastPermitDate: doc.lastPermitDate,
        hasOpenPermit: doc.hasOpenPermit,
        homeAgeYears: doc.homeAgeYears,
        ownerOccupied: doc.ownerOccupied,
        assessedValue: doc.assessedValue,
        lastSaleDate: doc.lastSaleDate,
        clusterId: doc.clusterId,
        cluster: doc.cluster,
        distanceMiles: doc.distanceMiles,
        vertical: doc.vertical,
        dataSource: doc.dataSource,
      }));
  },
});

/**
 * Insert or update a single lead by externalId.
 * Agent entry point for one-off ingest / testing.
 */
export const upsertLead = mutation({
  args: leadFields,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leads")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("leads", args);
  },
});

/**
 * Bulk upsert from ETL JSON array.
 * Agent entry point: read ETL output → call this mutation.
 *
 * Example (from a Convex action or seed script):
 *   bulkUpsertLeads({ leads: etlRows.map(row => ({ ...row, externalId: row.id, dataSource: "etl" })) })
 */
export const bulkUpsertLeads = mutation({
  args: {
    leads: v.array(v.object(leadFields)),
  },
  handler: async (ctx, { leads }) => {
    let inserted = 0;
    let updated = 0;

    for (const lead of leads) {
      const existing = await ctx.db
        .query("leads")
        .withIndex("by_external_id", (q) =>
          q.eq("externalId", lead.externalId),
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, lead);
        updated += 1;
      } else {
        await ctx.db.insert("leads", lead);
        inserted += 1;
      }
    }

    return { inserted, updated, total: leads.length };
  },
});

/**
 * Clear all leads — use before a full ETL reload.
 */
export const clearAllLeads = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("leads").collect();
    for (const doc of all) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: all.length };
  },
});
