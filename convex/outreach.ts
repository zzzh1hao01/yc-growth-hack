import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireMembership } from "./lib/auth";
import {
  isEnrichmentResult,
  mergeContactFields,
  normalizeStoredContactInfo,
} from "./lib/enrichmentTypes";

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
    sessionId: v.optional(v.string()),
    userId: v.optional(v.string()),
    leadId: v.id("leads"),
  },
  handler: async (ctx, { sessionId, userId, leadId }) => {
    if (userId) {
      const byUser = await ctx.db
        .query("outreach_records")
        .withIndex("by_user_lead", (q) => q.eq("userId", userId).eq("leadId", leadId))
        .first();
      if (byUser) return byUser;
    }

    if (sessionId) {
      return await ctx.db
        .query("outreach_records")
        .withIndex("by_session_lead", (q) =>
          q.eq("sessionId", sessionId).eq("leadId", leadId),
        )
        .first();
    }

    return null;
  },
});

export const getOutreachConfig = query({
  args: {
    orgId: v.optional(v.id("organizations")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, userId }) => {
    const siteUrl =
      process.env.CONVEX_SITE_URL?.trim() ||
      "https://compassionate-ptarmigan-622.convex.site";

    let sheetUrl = process.env.ORANGE_SLICE_SHEET_URL?.trim() || null;
    let envWebhook = process.env.ORANGE_SLICE_SHEET_WEBHOOK_URL?.trim() || null;

    if (orgId && userId) {
      try {
        await requireMembership(ctx, userId, orgId);
        const org = await ctx.db.get(orgId);
        if (org?.sheetUrl) sheetUrl = org.sheetUrl;
        if (org?.sheetWebhookUrl) envWebhook = org.sheetWebhookUrl;
      } catch {
        // Fall back to global env.
      }
    }

    const configDoc = await ctx.db.query("pipeline_config").first();
    const dbWebhook = configDoc?.sheetWebhookUrl?.trim() || null;
    const webhookConfigured = Boolean(envWebhook || dbWebhook);

    return {
      sheetUrl,
      sheetWebhookConfigured: webhookConfigured,
      sheetWebhookUrl: envWebhook || dbWebhook,
      pullLeadsUrl: `${siteUrl}/orangeslice/import`,
      importApiUrl: `${siteUrl}/orangeslice/import?limit=25`,
      configureWebhookUrl: `${siteUrl}/orangeslice/configure-webhook`,
      statusWebhookUrl: `${siteUrl}/orangeslice/status`,
      webhookAuthConfigured: Boolean(process.env.OUTREACH_WEBHOOK_SECRET?.trim()),
      convexSiteUrl: siteUrl,
    };
  },
});

export const createOutreachRecord = internalMutation({
  args: {
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
    event: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let existing = null;

    if (args.userId) {
      existing = await ctx.db
        .query("outreach_records")
        .withIndex("by_user_lead", (q) =>
          q.eq("userId", args.userId!).eq("leadId", args.leadId),
        )
        .first();
    }

    if (!existing) {
      existing = await ctx.db
        .query("outreach_records")
        .withIndex("by_session_lead", (q) =>
          q.eq("sessionId", args.sessionId).eq("leadId", args.leadId),
        )
        .first();
    }

    const activityEntry = {
      at: now,
      event: args.event,
      detail: args.detail,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        userId: args.userId ?? existing.userId,
        orgId: args.orgId ?? existing.orgId,
        primaryChannel: args.primaryChannel ?? existing.primaryChannel,
        campaignSlug: args.campaignSlug ?? existing.campaignSlug,
        enrichmentSnapshot: args.enrichmentSnapshot ?? existing.enrichmentSnapshot,
        sheetRowId: args.sheetRowId ?? existing.sheetRowId,
        sheetSyncedAt: args.sheetSyncedAt ?? existing.sheetSyncedAt,
        sheetPayload: args.sheetPayload ?? existing.sheetPayload,
        lastActivityAt: now,
        activityLog: [...existing.activityLog, activityEntry],
      });

      const notifyOrgId = args.orgId ?? existing.orgId;
      if (notifyOrgId) {
        const lead = await ctx.db.get(args.leadId);
        await ctx.scheduler.runAfter(0, internal.slackActions.notifyOrg, {
          orgId: notifyOrgId,
          event: args.event === "sheet_synced" ? "Lead pursued (sheet synced)" : "Lead pursued",
          address: lead?.address ?? args.householdId,
          status: args.status,
          gapDollars: lead?.replacementCostGapDollars,
        });
      }

      return existing._id;
    }

    const outreachId = await ctx.db.insert("outreach_records", {
      sessionId: args.sessionId,
      userId: args.userId,
      orgId: args.orgId,
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

    if (args.orgId) {
      const lead = await ctx.db.get(args.leadId);
      await ctx.scheduler.runAfter(0, internal.slackActions.notifyOrg, {
        orgId: args.orgId,
        event: args.event === "sheet_synced" ? "Lead pursued (sheet synced)" : "Lead pursued",
        address: lead?.address ?? args.householdId,
        status: args.status,
        gapDollars: lead?.replacementCostGapDollars,
      });
    }

    return outreachId;
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
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    phones: v.optional(v.array(v.string())),
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

    const hasContactUpdate =
      Boolean(args.email?.trim()) ||
      Boolean(args.phone?.trim()) ||
      Boolean(args.linkedinUrl?.trim()) ||
      (args.emails?.length ?? 0) > 0 ||
      (args.phones?.length ?? 0) > 0;

    if (target.orgId && args.status) {
      const lead = await ctx.db.get(target.leadId);
      await ctx.scheduler.runAfter(0, internal.slackActions.notifyOrg, {
        orgId: target.orgId,
        event: args.event ?? "status_update",
        address: lead?.address ?? target.householdId,
        status: args.status,
        gapDollars: lead?.replacementCostGapDollars,
        source: "orangeslice",
        detail: args.detail,
        email: args.email,
        phone: args.phone,
      });
    } else if (target.orgId && hasContactUpdate) {
      const lead = await ctx.db.get(target.leadId);
      await ctx.scheduler.runAfter(0, internal.slackActions.notifyOrg, {
        orgId: target.orgId,
        event: "contact_found",
        address: lead?.address ?? target.householdId,
        source: "orangeslice",
        email: args.email ?? args.emails?.[0],
        phone: args.phone ?? args.phones?.[0],
        detail: args.detail,
      });
    }

    if (hasContactUpdate) {
      const lead = await ctx.db.get(target.leadId);
      if (lead) {
        const existing = normalizeStoredContactInfo(lead.contactInfo);
        const merged = mergeContactFields(isEnrichmentResult(existing) ? existing : null, {
          email: args.email,
          phone: args.phone,
          linkedinUrl: args.linkedinUrl,
          emails: args.emails,
          phones: args.phones,
        });
        if (merged) {
          await ctx.db.patch(target.leadId, { contactInfo: merged });
        }
      }
    }

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

      if (target.orgId) {
        const lead = await ctx.db.get(target.leadId);
        await ctx.scheduler.runAfter(0, internal.slackActions.notifyOrg, {
          orgId: target.orgId,
          event: "sheet_imported",
          address: lead?.address ?? householdId,
          status: "sheet_synced",
          source: "orangeslice",
          detail: sheetRowIds?.[householdId],
        });
      }

      updated += 1;
    }

    return { updated };
  },
});

export const listOrgOutreach = query({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    status: v.optional(outreachStatus),
  },
  handler: async (ctx, { userId, orgId, status }) => {
    await requireMembership(ctx, userId, orgId);

    let records = await ctx.db
      .query("outreach_records")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    if (status) {
      records = records.filter((r) => r.status === status);
    }

    records.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

    const rows = await Promise.all(
      records.map(async (record) => {
        const lead = await ctx.db.get(record.leadId);
        const agent =
          record.userId != null
            ? await ctx.db
                .query("agents")
                .withIndex("by_user", (q) => q.eq("userId", record.userId!))
                .first()
            : record.sessionId
              ? await ctx.db
                  .query("agents")
                  .withIndex("by_session", (q) => q.eq("sessionId", record.sessionId))
                  .first()
              : null;

        const fallbackContractor =
          !agent && record.sessionId
            ? await ctx.db
                .query("contractors")
                .withIndex("by_session", (q) => q.eq("sessionId", record.sessionId))
                .first()
            : null;

        return {
          id: record._id,
          householdId: record.householdId,
          leadId: record.leadId,
          address: lead?.address ?? record.householdId,
          neighborhood: lead?.neighborhood,
          gapDollars: lead?.replacementCostGapDollars,
          matchScore: lead ? Math.round(lead.compositeScore * 100) : null,
          status: record.status,
          primaryChannel: record.primaryChannel,
          campaignSlug: record.campaignSlug,
          agentName: agent?.name ?? fallbackContractor?.name ?? "Agent",
          lastActivityAt: record.lastActivityAt,
          activityLog: record.activityLog,
        };
      }),
    );

    return rows;
  },
});

export const updateOutreachStatus = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    outreachId: v.id("outreach_records"),
    status: outreachStatus,
  },
  handler: async (ctx, { userId, orgId, outreachId, status }) => {
    await requireMembership(ctx, userId, orgId);

    const record = await ctx.db.get(outreachId);
    if (!record || record.orgId !== orgId) {
      throw new Error("Outreach record not found.");
    }

    const now = Date.now();
    await ctx.db.patch(outreachId, {
      status,
      lastActivityAt: now,
      activityLog: [
        ...record.activityLog,
        { at: now, event: "manual_update", detail: status },
      ],
    });

    return { ok: true };
  },
});
