import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { citywideMapSample, rankInsuranceLeads } from "./lib/scoring";
import { resolveAgentProfile } from "./lib/resolveAgent";

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
  archetype: v.optional(v.string()),
  acsReceptivityScore: v.optional(v.number()),
  financialSophistication: v.optional(v.number()),
  inertiaScore: v.optional(v.number()),
  coverageStakes: v.optional(v.number()),
};

const MAP_CAP = 400;

export const listLeads = query({
  args: {
    sessionId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, userId }) => {
    const docs = await ctx.db.query("leads").collect();
    if (docs.length === 0) return [];

    const profile = await resolveAgentProfile(ctx, { userId, sessionId });

    let agentLat: number | undefined;
    let agentLng: number | undefined;

    if (profile?.lat != null && profile.lng != null) {
      agentLat = profile.lat;
      agentLng = profile.lng;
    }

    const ranked = rankInsuranceLeads(docs, agentLat, agentLng);

    const sampleKey = sessionId ?? userId;
    if (sampleKey) {
      return citywideMapSample(ranked, sampleKey, MAP_CAP);
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
