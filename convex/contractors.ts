import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const getContractor = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("contractors")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
  },
});

export const saveContractor = internalMutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    businessDescription: v.string(),
    businessAddress: v.string(),
    businessName: v.optional(v.string()),
    lat: v.number(),
    lng: v.number(),
    serviceProfile: v.any(),
    companyContext: v.optional(v.any()),
    companyEnrichmentStatus: v.optional(
      v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    ),
    serviceRegionIds: v.optional(v.array(v.string())),
    serviceRegionLabel: v.optional(v.string()),
    targetNeighborhoods: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contractors")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const payload = {
      sessionId: args.sessionId,
      name: args.name,
      businessDescription: args.businessDescription,
      businessAddress: args.businessAddress,
      businessName: args.businessName,
      lat: args.lat,
      lng: args.lng,
      serviceProfile: args.serviceProfile,
      companyContext: args.companyContext,
      companyEnrichmentStatus: args.companyEnrichmentStatus,
      serviceRegionIds: args.serviceRegionIds,
      serviceRegionLabel: args.serviceRegionLabel,
      targetNeighborhoods: args.targetNeighborhoods,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("contractors", payload);
  },
});

export const patchCompanyContext = internalMutation({
  args: {
    sessionId: v.string(),
    companyContext: v.optional(v.any()),
    companyEnrichmentStatus: v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contractors")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!existing) return;

    await ctx.db.patch(existing._id, {
      companyContext: args.companyContext,
      companyEnrichmentStatus: args.companyEnrichmentStatus,
    });
  },
});

export const clearContractor = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const existing = await ctx.db
      .query("contractors")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
