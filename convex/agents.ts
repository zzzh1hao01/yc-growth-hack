import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireMembership } from "./lib/auth";
import { resolveAgentProfile } from "./lib/resolveAgent";

export const getAgent = query({
  args: {
    userId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await resolveAgentProfile(ctx, args);
  },
});

export const saveAgent = internalMutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    sessionId: v.optional(v.string()),
    name: v.string(),
    businessDescription: v.string(),
    businessAddress: v.string(),
    businessName: v.optional(v.string()),
    lat: v.number(),
    lng: v.number(),
    serviceProfile: v.any(),
    companyEnrichmentStatus: v.optional(
      v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    ),
    serviceRegionIds: v.optional(v.array(v.string())),
    serviceRegionLabel: v.optional(v.string()),
    targetNeighborhoods: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId),
      )
      .first();

    const payload = {
      userId: args.userId,
      orgId: args.orgId,
      sessionId: args.sessionId,
      name: args.name,
      businessDescription: args.businessDescription,
      businessAddress: args.businessAddress,
      businessName: args.businessName,
      lat: args.lat,
      lng: args.lng,
      serviceProfile: args.serviceProfile,
      companyEnrichmentStatus: args.companyEnrichmentStatus,
      serviceRegionIds: args.serviceRegionIds,
      serviceRegionLabel: args.serviceRegionLabel,
      targetNeighborhoods: args.targetNeighborhoods,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("agents", payload);
  },
});

export const patchAgentCompanyContext = internalMutation({
  args: {
    userId: v.string(),
    companyContext: v.optional(v.any()),
    companyEnrichmentStatus: v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!agent) return;

    await ctx.db.patch(agent._id, {
      companyContext: args.companyContext,
      companyEnrichmentStatus: args.companyEnrichmentStatus,
    });
  },
});

export const clearAgent = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (agent) {
      await ctx.db.delete(agent._id);
    }
  },
});

export const listOrgAgents = query({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, { userId, orgId }) => {
    await requireMembership(ctx, userId, orgId);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const agents = await Promise.all(
      memberships.map(async (m) => {
        const agent = await ctx.db
          .query("agents")
          .withIndex("by_org_user", (q) =>
            q.eq("orgId", orgId).eq("userId", m.userId),
          )
          .first();
        return {
          userId: m.userId,
          role: m.role,
          name: agent?.name ?? "Agent",
        };
      }),
    );

    return agents;
  },
});
