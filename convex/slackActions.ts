"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  deliverSlackMessage,
  orangeSliceSlackMessage,
  outreachSlackMessage,
  resolveSlackDelivery,
  slackViaOrangeSlice,
} from "./lib/slack";

export const notifyOrg = internalAction({
  args: {
    orgId: v.id("organizations"),
    event: v.string(),
    address: v.string(),
    agentName: v.optional(v.string()),
    status: v.optional(v.string()),
    gapDollars: v.optional(v.number()),
    source: v.optional(v.union(v.literal("orangeslice"), v.literal("app"))),
    detail: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.runQuery(internal.slackData.getOrgSlackConfig, {
      orgId: args.orgId,
    });
    const delivery = resolveSlackDelivery(
      org?.slackChannelId,
      org?.slackAccessToken,
      org?.slackWebhookUrl,
    );
    if (!delivery) {
      return {
        sent: false,
        error: slackViaOrangeSlice()
          ? "Add a Slack incoming webhook in Settings (or SLACK_WEBHOOK_URL in Convex)"
          : "Slack not configured",
      };
    }

    const text =
      args.source === "orangeslice"
        ? orangeSliceSlackMessage({
            address: args.address,
            status: args.status,
            event: args.event,
            detail: args.detail,
            email: args.email,
            phone: args.phone,
          })
        : outreachSlackMessage({
            event: args.event,
            address: args.address,
            agentName: args.agentName,
            status: args.status,
            gapDollars: args.gapDollars,
          });

    const result = await deliverSlackMessage(delivery, text);
    return { sent: result.ok, error: result.error };
  },
});
