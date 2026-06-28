import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leads: defineTable({
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
  }).index("by_household_id", ["householdId"]),

  contractors: defineTable({
    sessionId: v.string(),
    name: v.string(),
    businessDescription: v.string(),
    businessAddress: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    serviceProfile: v.optional(v.any()),
    companyContext: v.optional(v.any()),
    companyEnrichmentStatus: v.optional(
      v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    ),
    serviceRegionIds: v.optional(v.array(v.string())),
    serviceRegionLabel: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),

  chatHistory: defineTable({
    sessionId: v.string(),
    leadId: v.id("leads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }).index("by_session_lead", ["sessionId", "leadId"]),
});
