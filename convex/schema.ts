import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const outreachStatus = v.union(
  v.literal("queued"),
  v.literal("sheet_synced"),
  v.literal("touch1_ready"),
  v.literal("touch1_sent"),
  v.literal("touch2_sent"),
  v.literal("replied"),
  v.literal("meeting"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("d2d_planned"),
);

const membershipRole = v.union(v.literal("admin"), v.literal("member"));

export default defineSchema({
  leads: defineTable({
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
    assessorBlock: v.optional(v.string()),
    assessorLot: v.optional(v.string()),
    parcelNumber: v.optional(v.string()),
    ownerFirstName: v.optional(v.string()),
    ownerLastName: v.optional(v.string()),
    ownerFullName: v.optional(v.string()),
    ownerLinkedInUrl: v.optional(v.string()),
    ownerNameSource: v.optional(v.string()),
    ownerContactRole: v.optional(
      v.union(v.literal("owner"), v.literal("resident"), v.literal("unknown")),
    ),
    persona: v.optional(v.any()),
    contactInfo: v.optional(v.any()),
    archetype: v.optional(v.string()),
    acsReceptivityScore: v.optional(v.number()),
    financialSophistication: v.optional(v.number()),
    inertiaScore: v.optional(v.number()),
    coverageStakes: v.optional(v.number()),
  })
    .index("by_household_id", ["householdId"])
    .index("by_composite_score", ["compositeScore"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    inviteCode: v.string(),
    sheetUrl: v.optional(v.string()),
    sheetWebhookUrl: v.optional(v.string()),
    slackTeamId: v.optional(v.string()),
    slackChannelId: v.optional(v.string()),
    slackWebhookUrl: v.optional(v.string()),
    slackAccessToken: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_invite_code", ["inviteCode"]),

  memberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    role: membershipRole,
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"]),

  agents: defineTable({
    userId: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    businessDescription: v.string(),
    businessAddress: v.string(),
    businessName: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    serviceProfile: v.optional(v.any()),
    companyContext: v.optional(v.any()),
    companyEnrichmentStatus: v.optional(
      v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    ),
    serviceRegionIds: v.optional(v.array(v.string())),
    serviceRegionLabel: v.optional(v.string()),
    targetNeighborhoods: v.optional(v.array(v.string())),
    sessionId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_session", ["sessionId"]),

  // Session-scoped insurance agent profile (legacy + anonymous fallback).
  contractors: defineTable({
    sessionId: v.string(),
    name: v.string(),
    businessDescription: v.string(),
    businessAddress: v.string(),
    businessName: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    serviceProfile: v.optional(v.any()),
    companyContext: v.optional(v.any()),
    companyEnrichmentStatus: v.optional(
      v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    ),
    serviceRegionIds: v.optional(v.array(v.string())),
    serviceRegionLabel: v.optional(v.string()),
    targetNeighborhoods: v.optional(v.array(v.string())),
  }).index("by_session", ["sessionId"]),

  chatHistory: defineTable({
    sessionId: v.string(),
    orgId: v.optional(v.id("organizations")),
    leadId: v.id("leads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }).index("by_session_lead", ["sessionId", "leadId"]),

  outreach_records: defineTable({
    sessionId: v.string(),
    userId: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
    leadId: v.id("leads"),
    householdId: v.string(),
    status: outreachStatus,
    primaryChannel: v.optional(
      v.union(
        v.literal("email"),
        v.literal("phone"),
        v.literal("linkedin"),
        v.literal("mail"),
        v.literal("d2d"),
      ),
    ),
    campaignSlug: v.optional(v.string()),
    enrichmentSnapshot: v.optional(v.any()),
    sheetRowId: v.optional(v.string()),
    sheetSyncedAt: v.optional(v.number()),
    sheetPayload: v.optional(v.any()),
    lastActivityAt: v.number(),
    activityLog: v.array(
      v.object({
        at: v.number(),
        event: v.string(),
        detail: v.optional(v.string()),
      }),
    ),
  })
    .index("by_session_lead", ["sessionId", "leadId"])
    .index("by_user_lead", ["userId", "leadId"])
    .index("by_org", ["orgId"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_household", ["householdId"])
    .index("by_status", ["status"]),

  pipeline_config: defineTable({
    sheetWebhookUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }),
});
