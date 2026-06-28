import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const getChatHistory = query({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
  },
  handler: async (ctx, { sessionId, leadId }) => {
    const rows = await ctx.db
      .query("chatHistory")
      .withIndex("by_session_lead", (q) =>
        q.eq("sessionId", sessionId).eq("leadId", leadId),
      )
      .collect();

    return rows.map((row) => ({
      role: row.role,
      content: row.content,
    }));
  },
});

export const appendChatTurn = internalMutation({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
    userMessage: v.string(),
    assistantMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatHistory", {
      sessionId: args.sessionId,
      leadId: args.leadId,
      role: "user",
      content: args.userMessage,
    });
    await ctx.db.insert("chatHistory", {
      sessionId: args.sessionId,
      leadId: args.leadId,
      role: "assistant",
      content: args.assistantMessage,
    });
  },
});

export const clearChatHistory = mutation({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
  },
  handler: async (ctx, { sessionId, leadId }) => {
    const rows = await ctx.db
      .query("chatHistory")
      .withIndex("by_session_lead", (q) =>
        q.eq("sessionId", sessionId).eq("leadId", leadId),
      )
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length };
  },
});
