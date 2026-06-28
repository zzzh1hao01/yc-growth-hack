import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { demoSampleLeads, rankInsuranceLeads } from "./lib/scoring";

const insuranceHouseholdFields = {
  householdId: v.string(),
  address: v.string(),
  lat: v.number(),
  lng: v.number(),
  neighborhood: v.string(),
  sqft: v.number(),
  ownerOccupied: v.boolean(),
  replacementCostToday: v.number(),
  coverageAnchor: v.number(),
  replacementCostGapDollars: v.number(),
  replacementCostGapPct: v.number(),
  needScore: v.number(),
  timingScore: v.number(),
  timingConfidence: v.union(
    v.literal("high"),
    v.literal("low"),
    v.literal("none"),
  ),
  compositeScore: v.number(),
  worthOutreach: v.boolean(),
  yearBuilt: v.optional(v.number()),
  purchaseYear: v.optional(v.number()),
  yearsOwned: v.optional(v.number()),
  spriteVariant: v.number(),
  recordedOwnerFullName: v.optional(v.string()),
  recordedOwnerSource: v.optional(v.string()),
  ownerFirstName: v.optional(v.string()),
  ownerLastName: v.optional(v.string()),
  ownerFullName: v.optional(v.string()),
  ownerNameSource: v.optional(v.string()),
  assessorBlock: v.optional(v.string()),
  assessorLot: v.optional(v.string()),
  parcelNumber: v.optional(v.string()),
};

const MAP_CAP = 100;

export const listLeads = query({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const docs = await ctx.db.query("leads").collect();
    if (docs.length === 0) return [];

    let agentLat: number | undefined;
    let agentLng: number | undefined;
    let targetNeighborhoods: string[] | undefined;

    if (sessionId) {
      const agent = await ctx.db
        .query("contractors")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .first();
      if (agent?.lat != null && agent.lng != null) {
        agentLat = agent.lat;
        agentLng = agent.lng;
      }
      targetNeighborhoods = agent?.targetNeighborhoods ?? undefined;
    }

    let scoped = docs;
    if (targetNeighborhoods?.length) {
      const allowed = new Set(targetNeighborhoods);
      scoped = docs.filter((doc) => allowed.has(doc.neighborhood));
      if (scoped.length === 0) scoped = docs;
    }

    const ranked = rankInsuranceLeads(scoped, agentLat, agentLng);

    if (sessionId) {
      return demoSampleLeads(ranked, sessionId, MAP_CAP);
    }

    return ranked.slice(0, MAP_CAP);
  },
});

export const getLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    return await ctx.db.get(leadId);
  },
});

export const bulkUpsertHouseholds = mutation({
  args: { households: v.array(v.object(insuranceHouseholdFields)) },
  handler: async (ctx, { households }) => {
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

export const patchLeadPersona = internalMutation({
  args: {
    leadId: v.id("leads"),
    persona: v.any(),
  },
  handler: async (ctx, { leadId, persona }) => {
    await ctx.db.patch(leadId, { persona });
  },
});

export const clearLeadPersona = internalMutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    await ctx.db.patch(leadId, { persona: undefined });
  },
});

export const patchLeadContactInfo = internalMutation({
  args: {
    leadId: v.id("leads"),
    contactInfo: v.any(),
  },
  handler: async (ctx, { leadId, contactInfo }) => {
    await ctx.db.patch(leadId, { contactInfo });
  },
});

export const patchLeadOwner = internalMutation({
  args: {
    leadId: v.id("leads"),
    ownerFirstName: v.string(),
    ownerLastName: v.string(),
    ownerFullName: v.string(),
    ownerLinkedInUrl: v.optional(v.string()),
    ownerNameSource: v.string(),
    ownerContactRole: v.optional(
      v.union(v.literal("owner"), v.literal("resident"), v.literal("unknown")),
    ),
    assessorBlock: v.optional(v.string()),
    assessorLot: v.optional(v.string()),
    parcelNumber: v.optional(v.string()),
    ownerOccupied: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      ownerFirstName: args.ownerFirstName,
      ownerLastName: args.ownerLastName,
      ownerFullName: args.ownerFullName,
      ownerLinkedInUrl: args.ownerLinkedInUrl,
      ownerNameSource: args.ownerNameSource,
      ownerContactRole: args.ownerContactRole,
      assessorBlock: args.assessorBlock,
      assessorLot: args.assessorLot,
      parcelNumber: args.parcelNumber,
      ...(args.ownerOccupied !== undefined ? { ownerOccupied: args.ownerOccupied } : {}),
    });
  },
});
