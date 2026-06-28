import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  demoSampleLeads,
  pickVertical,
  rankLeads,
  type ServiceProfile,
} from "./lib/scoring";
import {
  findPrimaryRegion,
  leadInServiceAreas,
  resolveServiceAreas,
} from "./lib/sfRegions";

const householdFields = {
  householdId: v.string(),
  address: v.string(),
  lat: v.number(),
  lng: v.number(),
  yearBuilt: v.number(),
  ownerOccupied: v.boolean(),
  assessedValue: v.number(),
  lastSaleDate: v.optional(v.string()),
  clusterId: v.number(),
  verticalScores: v.any(),
  spriteVariant: v.number(),
};

const DEMO_MAP_CAP = 30;

export const listLeads = query({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, { sessionId }) => {
    const docs = await ctx.db.query("leads").collect();
    if (docs.length === 0) return [];

    let contractorLat: number | undefined;
    let contractorLng: number | undefined;
    let serviceProfile: ServiceProfile | null = null;
    let serviceRegionIds: string[] | undefined;

    if (sessionId) {
      const contractor = await ctx.db
        .query("contractors")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .first();
      if (contractor?.lat != null && contractor.lng != null) {
        contractorLat = contractor.lat;
        contractorLng = contractor.lng;
        serviceProfile = contractor.serviceProfile as ServiceProfile | null;
        serviceRegionIds = contractor.serviceRegionIds ?? undefined;

        if (!serviceRegionIds?.length) {
          serviceRegionIds = resolveServiceAreas(contractor.lat, contractor.lng).regionIds;
        }
      }
    }

    let scoped = docs;
    if (serviceRegionIds?.length) {
      scoped = docs.filter((doc) =>
        leadInServiceAreas(doc.lat, doc.lng, serviceRegionIds!),
      );
      // Demo ETL only covers Sunset/Parkside — still rank those leads by contractor proximity.
      if (scoped.length === 0) {
        scoped = docs;
      }
    }

    const vertical = pickVertical(serviceProfile);
    const ranked = rankLeads(
      scoped,
      vertical,
      contractorLat,
      contractorLng,
      serviceProfile,
      (doc) => findPrimaryRegion(doc.lat, doc.lng)?.name,
    );

    if (sessionId) {
      return demoSampleLeads(ranked, sessionId, DEMO_MAP_CAP);
    }

    return ranked.slice(0, DEMO_MAP_CAP);
  },
});

export const getLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    return await ctx.db.get(leadId);
  },
});

export const bulkUpsertHouseholds = mutation({
  args: { households: v.array(v.object(householdFields)) },
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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      ownerFirstName: args.ownerFirstName,
      ownerLastName: args.ownerLastName,
      ownerFullName: args.ownerFullName,
      ownerLinkedInUrl: args.ownerLinkedInUrl,
      ownerNameSource: args.ownerNameSource,
      ownerContactRole: args.ownerContactRole,
    });
  },
});
