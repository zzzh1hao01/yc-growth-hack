"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { outreachSlackMessage, postSlackMessage } from "./lib/slack";

export const notifyOrg = internalAction({
  args: {
    orgId: v.id("organizations"),
    event: v.string(),
    address: v.string(),
    agentName: v.optional(v.string()),
    status: v.optional(v.string()),
    gapDollars: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.runQuery(internal.slackData.getOrgSlackConfig, {
      orgId: args.orgId,
    });
    if (!org?.slackAccessToken || !org.slackChannelId) return { sent: false };

    const text = outreachSlackMessage({
      event: args.event,
      address: args.address,
      agentName: args.agentName,
      status: args.status,
      gapDollars: args.gapDollars,
    });

    const result = await postSlackMessage(
      org.slackAccessToken,
      org.slackChannelId,
      text,
    );
    return { sent: result.ok, error: result.error };
  },
});
