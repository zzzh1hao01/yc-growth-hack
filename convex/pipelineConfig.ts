import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const getSheetWebhookUrl = internalQuery({
  args: {},
  handler: async (ctx) => {
    const envUrl = process.env.ORANGE_SLICE_SHEET_WEBHOOK_URL?.trim();
    if (envUrl) return envUrl;

    const doc = await ctx.db.query("pipeline_config").first();

    return doc?.sheetWebhookUrl?.trim() || null;
  },
});

export const getPipelineConfig = query({
  args: {},
  handler: async (ctx) => {
    const envUrl = process.env.ORANGE_SLICE_SHEET_WEBHOOK_URL?.trim();
    const doc = await ctx.db.query("pipeline_config").first();
    const dbUrl = doc?.sheetWebhookUrl?.trim() || null;

    return {
      sheetWebhookUrl: envUrl || dbUrl,
      sheetWebhookConfigured: Boolean(envUrl || dbUrl),
      sheetWebhookSource: envUrl ? ("env" as const) : dbUrl ? ("database" as const) : null,
      updatedAt: doc?.updatedAt ?? null,
    };
  },
});

export const setSheetWebhookUrl = internalMutation({
  args: {
    sheetWebhookUrl: v.string(),
  },
  handler: async (ctx, { sheetWebhookUrl }) => {
    const url = sheetWebhookUrl.trim();
    if (!url.startsWith("http")) {
      throw new Error("sheetWebhookUrl must be an http(s) URL");
    }

    const now = Date.now();
    const existing = await ctx.db.query("pipeline_config").first();

    if (existing) {
      await ctx.db.patch(existing._id, { sheetWebhookUrl: url, updatedAt: now });
      return { updated: true, sheetWebhookUrl: url };
    }

    await ctx.db.insert("pipeline_config", { sheetWebhookUrl: url, updatedAt: now });
    return { updated: true, sheetWebhookUrl: url };
  },
});
