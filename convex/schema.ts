import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Leads table — one row per geocoded parcel/address on the bounty board.
 *
 * Agent docs: docs/DATA_INTEGRATION.md
 * Ingest via: api.leads.bulkUpsertLeads or api.leads.upsertLead
 */
export default defineSchema({
  leads: defineTable({
    // Geolocation (required — map pin)
    address: v.string(),
    lat: v.number(),
    lng: v.number(),
    neighborhood: v.optional(v.string()),

    // Scoring
    matchScore: v.number(),
    urgent: v.boolean(),
    spriteVariant: v.number(), // 0–3, visual only

    // Permits (SF Open Data)
    permitAgeYears: v.number(),
    lastPermitType: v.optional(v.string()),
    lastPermitDate: v.optional(v.string()),
    hasOpenPermit: v.optional(v.boolean()),

    // Assessor / parcel
    homeAgeYears: v.number(),
    ownerOccupied: v.optional(v.boolean()),
    assessedValue: v.optional(v.number()),
    lastSaleDate: v.optional(v.string()),

    // Behavioral cluster
    clusterId: v.optional(v.string()),
    cluster: v.string(),

    // Proximity & metadata
    distanceMiles: v.optional(v.number()),
    vertical: v.optional(v.union(v.literal("hvac"), v.literal("electrical"))),
    dataSource: v.optional(
      v.union(v.literal("placeholder"), v.literal("etl")),
    ),

    // External stable id from ETL (parcel id or address hash)
    externalId: v.string(),
  })
    .index("by_match_score", ["matchScore"])
    .index("by_external_id", ["externalId"])
    .index("by_neighborhood", ["neighborhood"]),
});
