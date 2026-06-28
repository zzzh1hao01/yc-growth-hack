import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getOrgSlackConfig = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db.get(orgId);
    if (!org) return null;
    return {
      slackAccessToken: org.slackAccessToken ?? null,
      slackChannelId: org.slackChannelId ?? null,
      slackWebhookUrl: org.slackWebhookUrl ?? null,
    };
  },
});
