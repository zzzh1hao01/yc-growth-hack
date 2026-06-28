import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  orgId: Id<"organizations">,
  minRole?: "admin" | "member",
) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .first();

  if (!membership) {
    throw new Error("Not a member of this organization.");
  }

  if (minRole === "admin" && membership.role !== "admin") {
    throw new Error("Admin access required.");
  }

  return membership;
}
