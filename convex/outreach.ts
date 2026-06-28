import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

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

export const getOutreachForLead = query({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
  },
  handler: async (ctx, { sessionId, leadId }) => {
    return await ctx.db
      .query("outreach_records")
      .withIndex("by_session_lead", (q) =>
        q.eq("sessionId", sessionId).eq("leadId", leadId),
      )
      .first();
  },
});

export const getOutreachConfig = query({
  args: {},
  handler: async (ctx) => {
    const siteUrl = process.env.CONVEX_SITE_URL?.trim();
    const envWebhook = process.env.ORANGE_SLICE_SHEET_WEBHOOK_URL?.trim();
    const configDoc = await ctx.db.query("pipeline_config").first();
    const dbWebhook = configDoc?.sheetWebhookUrl?.trim() || null;
    const webhookConfigured = Boolean(envWebhook || dbWebhook);

    return {
      sheetUrl: process.env.ORANGE_SLICE_SHEET_URL?.trim() || null,
      sheetWebhookConfigured: webhookConfigured,
      sheetWebhookUrl: envWebhook || dbWebhook,
      pullLeadsUrl: siteUrl ? `${siteUrl}/orangeslice/import` : null,
      importApiUrl: siteUrl ? `${siteUrl}/orangeslice/import?limit=25` : null,
      configureWebhookUrl: siteUrl ? `${siteUrl}/orangeslice/configure-webhook` : null,
      statusWebhookUrl: siteUrl ? `${siteUrl}/orangeslice/status` : null,
      webhookAuthConfigured: Boolean(process.env.OUTREACH_WEBHOOK_SECRET?.trim()),
    };
  },
});

export const createOutreachRecord = internalMutation({
  args: {
    sessionId: v.string(),
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
    event: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("outreach_records")
      .withIndex("by_session_lead", (q) =>
        q.eq("sessionId", args.sessionId).eq("leadId", args.leadId),
      )
      .first();

    const activityEntry = {
      at: now,
      event: args.event,
      detail: args.detail,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        primaryChannel: args.primaryChannel ?? existing.primaryChannel,
        campaignSlug: args.campaignSlug ?? existing.campaignSlug,
        enrichmentSnapshot: args.enrichmentSnapshot ?? existing.enrichmentSnapshot,
        sheetRowId: args.sheetRowId ?? existing.sheetRowId,
        sheetSyncedAt: args.sheetSyncedAt ?? existing.sheetSyncedAt,
        sheetPayload: args.sheetPayload ?? existing.sheetPayload,
        lastActivityAt: now,
        activityLog: [...existing.activityLog, activityEntry],
      });
      return existing._id;
    }

    return await ctx.db.insert("outreach_records", {
      sessionId: args.sessionId,
      leadId: args.leadId,
      householdId: args.householdId,
      status: args.status,
      primaryChannel: args.primaryChannel,
      campaignSlug: args.campaignSlug,
      enrichmentSnapshot: args.enrichmentSnapshot,
      sheetRowId: args.sheetRowId,
      sheetSyncedAt: args.sheetSyncedAt,
      sheetPayload: args.sheetPayload,
      lastActivityAt: now,
      activityLog: [activityEntry],
    });
  },
});

export const applySheetStatus = internalMutation({
  args: {
    householdId: v.string(),
    status: v.optional(outreachStatus),
    sheetRowId: v.optional(v.string()),
    event: v.optional(v.string()),
    detail: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("outreach_records")
      .withIndex("by_household", (q) => q.eq("householdId", args.householdId))
      .collect();

    const target =
      (args.sessionId
        ? records.find((record) => record.sessionId === args.sessionId)
        : undefined) ?? records.at(-1);

    if (!target) {
      return { updated: false, reason: "no_outreach_record" as const };
    }

    const now = Date.now();
    await ctx.db.patch(target._id, {
      status: args.status ?? target.status,
      sheetRowId: args.sheetRowId ?? target.sheetRowId,
      lastActivityAt: now,
      activityLog: [
        ...target.activityLog,
        {
          at: now,
          event: args.event ?? "sheet_status",
          detail: args.detail,
        },
      ],
    });

    return { updated: true, outreachId: target._id };
  },
});

export const markTouchSent = internalMutation({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
    touch: v.union(v.literal("touch1"), v.literal("touch2")),
    channel: v.optional(
      v.union(
        v.literal("email"),
        v.literal("phone"),
        v.literal("linkedin"),
        v.literal("mail"),
        v.literal("d2d"),
      ),
    ),
  },
  handler: async (ctx, { sessionId, leadId, touch, channel }) => {
    const record = await ctx.db
      .query("outreach_records")
      .withIndex("by_session_lead", (q) =>
        q.eq("sessionId", sessionId).eq("leadId", leadId),
      )
      .first();

    if (!record) return { updated: false };

    const now = Date.now();
    const status = touch === "touch1" ? "touch1_sent" : "touch2_sent";
    await ctx.db.patch(record._id, {
      status,
      primaryChannel: channel ?? record.primaryChannel,
      lastActivityAt: now,
      activityLog: [
        ...record.activityLog,
        {
          at: now,
          event: status,
          detail: channel,
        },
      ],
    });

    return { updated: true };
  },
});

export const listPendingSheetLeads = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const cap = limit ?? 25;
    const pending = await ctx.db
      .query("outreach_records")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .take(cap);

    const touchReady = pending.length < cap
      ? await ctx.db
          .query("outreach_records")
          .withIndex("by_status", (q) => q.eq("status", "touch1_ready"))
          .take(cap - pending.length)
      : [];

    const records = [...pending, ...touchReady].filter(
      (record) => record.sheetPayload != null,
    );

    return records.map((record) => ({
      outreachId: record._id,
      householdId: record.householdId,
      sessionId: record.sessionId,
      status: record.status,
      payload: record.sheetPayload,
    }));
  },
});

export const ackSheetLeads = internalMutation({
  args: {
    householdIds: v.array(v.string()),
    sheetRowIds: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, { householdIds, sheetRowIds }) => {
    const now = Date.now();
    let updated = 0;

    for (const householdId of householdIds) {
      const records = await ctx.db
        .query("outreach_records")
        .withIndex("by_household", (q) => q.eq("householdId", householdId))
        .collect();

      const target = records
        .filter((record) => record.status === "queued" || record.status === "touch1_ready")
        .at(-1);

      if (!target) continue;

      await ctx.db.patch(target._id, {
        status: "sheet_synced",
        sheetRowId: sheetRowIds?.[householdId] ?? target.sheetRowId,
        sheetSyncedAt: now,
        lastActivityAt: now,
        activityLog: [
          ...target.activityLog,
          {
            at: now,
            event: "sheet_synced",
            detail: sheetRowIds?.[householdId] ?? "imported",
          },
        ],
      });
      updated += 1;
    }

    return { updated };
  },
});
