import { v } from "convex/values";
import {
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireMembership } from "./lib/auth";
import { isSlackConfigured } from "./lib/slack";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function randomInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const getOrgPipelineConfig = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db.get(orgId);
    if (!org) return null;
    return {
      sheetUrl: org.sheetUrl ?? null,
      sheetWebhookUrl: org.sheetWebhookUrl ?? null,
    };
  },
});

export const getMyMembership = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return null;

    const org = await ctx.db.get(membership.orgId);
    if (!org) return null;

    return {
      orgId: membership.orgId,
      role: membership.role,
      org: {
        id: org._id,
        name: org.name,
        slug: org.slug,
        sheetUrl: org.sheetUrl ?? null,
        sheetWebhookUrl: org.sheetWebhookUrl ?? null,
        slackConnected: isSlackConfigured(
          org.slackChannelId,
          org.slackAccessToken,
          org.slackWebhookUrl,
        ),
      },
    };
  },
});

export const createOrganization = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { userId, name }) => {
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existingMembership) {
      throw new Error("You already belong to an organization.");
    }

    const baseSlug = slugify(name) || "agency";
    let slug = baseSlug;
    let suffix = 0;
    while (
      await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    ) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name: name.trim(),
      slug,
      inviteCode: randomInviteCode(),
      createdAt: now,
    });

    await ctx.db.insert("memberships", {
      orgId,
      userId,
      role: "admin",
      joinedAt: now,
    });

    return { orgId, slug };
  },
});

export const joinOrganization = mutation({
  args: {
    userId: v.string(),
    inviteCode: v.string(),
  },
  handler: async (ctx, { userId, inviteCode }) => {
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existingMembership) {
      throw new Error("You already belong to an organization.");
    }

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_invite_code", (q) =>
        q.eq("inviteCode", inviteCode.trim().toUpperCase()),
      )
      .first();
    if (!org) throw new Error("Invalid invite code.");

    await ctx.db.insert("memberships", {
      orgId: org._id,
      userId,
      role: "member",
      joinedAt: Date.now(),
    });

    return { orgId: org._id, name: org.name };
  },
});

export const updateOrgIntegrations = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    sheetUrl: v.optional(v.string()),
    sheetWebhookUrl: v.optional(v.string()),
    slackTeamId: v.optional(v.string()),
    slackChannelId: v.optional(v.string()),
    slackWebhookUrl: v.optional(v.string()),
    slackAccessToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.userId, args.orgId, "admin");

    const patch: Record<string, string | undefined> = {};
    if (args.sheetUrl !== undefined) {
      patch.sheetUrl = args.sheetUrl.trim() || undefined;
    }
    if (args.sheetWebhookUrl !== undefined) {
      const url = args.sheetWebhookUrl.trim();
      if (url && !url.startsWith("http")) {
        throw new Error("Sheet webhook URL must be http(s)");
      }
      patch.sheetWebhookUrl = url || undefined;
    }
    if (args.slackTeamId !== undefined) patch.slackTeamId = args.slackTeamId;
    if (args.slackChannelId !== undefined) patch.slackChannelId = args.slackChannelId;
    if (args.slackWebhookUrl !== undefined) {
      const url = args.slackWebhookUrl.trim();
      if (url && !url.startsWith("https://hooks.slack.com/")) {
        throw new Error("Slack webhook must start with https://hooks.slack.com/");
      }
      patch.slackWebhookUrl = url || undefined;
    }
    if (args.slackAccessToken !== undefined) {
      patch.slackAccessToken = args.slackAccessToken;
    }

    await ctx.db.patch(args.orgId, patch);
    return { ok: true };
  },
});

export const getOrgSettings = query({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, { userId, orgId }) => {
    await requireMembership(ctx, userId, orgId);

    const org = await ctx.db.get(orgId);
    if (!org) throw new Error("Organization not found");

    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return {
      name: org.name,
      slug: org.slug,
      inviteCode: org.inviteCode,
      sheetUrl: org.sheetUrl ?? null,
      sheetWebhookUrl: org.sheetWebhookUrl ?? null,
      slackConnected: isSlackConfigured(
        org.slackChannelId,
        org.slackAccessToken,
        org.slackWebhookUrl,
      ),
      slackChannelId: org.slackChannelId ?? null,
      slackWebhookUrl: org.slackWebhookUrl ?? null,
      slackWebhookConfigured: Boolean(org.slackWebhookUrl?.trim()),
      memberCount: members.length,
    };
  },
});
