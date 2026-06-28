import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type ResolvedAgentProfile = {
  name: string;
  businessDescription: string;
  businessAddress: string;
  businessName?: string;
  lat?: number;
  lng?: number;
  serviceProfile?: unknown;
  companyContext?: unknown;
  companyEnrichmentStatus?: "pending" | "done" | "failed";
  serviceRegionIds?: string[];
  serviceRegionLabel?: string;
  targetNeighborhoods?: string[];
  userId?: string;
  orgId?: Id<"organizations">;
  sessionId?: string;
};

function fromAgentDoc(doc: {
  name: string;
  businessDescription: string;
  businessAddress: string;
  businessName?: string;
  lat?: number;
  lng?: number;
  serviceProfile?: unknown;
  companyContext?: unknown;
  companyEnrichmentStatus?: "pending" | "done" | "failed";
  serviceRegionIds?: string[];
  serviceRegionLabel?: string;
  targetNeighborhoods?: string[];
  userId: string;
  orgId: Id<"organizations">;
  sessionId?: string;
}): ResolvedAgentProfile {
  return {
    name: doc.name,
    businessDescription: doc.businessDescription,
    businessAddress: doc.businessAddress,
    businessName: doc.businessName,
    lat: doc.lat,
    lng: doc.lng,
    serviceProfile: doc.serviceProfile,
    companyContext: doc.companyContext,
    companyEnrichmentStatus: doc.companyEnrichmentStatus,
    serviceRegionIds: doc.serviceRegionIds,
    serviceRegionLabel: doc.serviceRegionLabel,
    targetNeighborhoods: doc.targetNeighborhoods,
    userId: doc.userId,
    orgId: doc.orgId,
    sessionId: doc.sessionId,
  };
}

function fromContractorDoc(doc: {
  name: string;
  businessDescription: string;
  businessAddress: string;
  businessName?: string;
  lat?: number;
  lng?: number;
  serviceProfile?: unknown;
  companyContext?: unknown;
  companyEnrichmentStatus?: "pending" | "done" | "failed";
  serviceRegionIds?: string[];
  serviceRegionLabel?: string;
  targetNeighborhoods?: string[];
  sessionId: string;
}): ResolvedAgentProfile {
  return {
    name: doc.name,
    businessDescription: doc.businessDescription,
    businessAddress: doc.businessAddress,
    businessName: doc.businessName,
    lat: doc.lat,
    lng: doc.lng,
    serviceProfile: doc.serviceProfile,
    companyContext: doc.companyContext,
    companyEnrichmentStatus: doc.companyEnrichmentStatus,
    serviceRegionIds: doc.serviceRegionIds,
    serviceRegionLabel: doc.serviceRegionLabel,
    targetNeighborhoods: doc.targetNeighborhoods,
    sessionId: doc.sessionId,
  };
}

export async function resolveAgentProfile(
  ctx: QueryCtx | MutationCtx,
  args: { userId?: string; sessionId?: string },
): Promise<ResolvedAgentProfile | null> {
  if (args.userId) {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .first();
    if (agent?.lat != null) return fromAgentDoc(agent);
  }

  if (args.sessionId) {
    const linkedAgent = await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId!))
      .first();
    if (linkedAgent?.lat != null) return fromAgentDoc(linkedAgent);

    const contractor = await ctx.db
      .query("contractors")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId!))
      .first();
    if (contractor?.lat != null) return fromContractorDoc(contractor);
  }

  return null;
}
