import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authorizeOutreachRequest, jsonResponse } from "./lib/httpAuth";
import { flattenSheetPayload, type SheetLeadPayload } from "./lib/orangesliceSheet";

const http = httpRouter();

function flatImportRows(
  leads: Array<{ householdId: string; payload: unknown }>,
): ReturnType<typeof flattenSheetPayload>[] {
  return leads
    .map((lead) => lead.payload)
    .filter((payload): payload is SheetLeadPayload => Boolean(payload))
    .map((payload) => flattenSheetPayload(payload));
}

http.route({
  path: "/orangeslice/configure-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authError = authorizeOutreachRequest(request);
    if (authError) return authError;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const webhookUrl =
      (typeof body.webhook_url === "string" ? body.webhook_url : undefined) ??
      (typeof body.webhookUrl === "string" ? body.webhookUrl : undefined) ??
      (typeof body.url === "string" ? body.url : undefined);

    if (!webhookUrl?.startsWith("http")) {
      return jsonResponse({ error: "webhook_url required (http/https)" }, 400);
    }

    const result = await ctx.runMutation(internal.pipelineConfig.setSheetWebhookUrl, {
      sheetWebhookUrl: webhookUrl,
    });

    return jsonResponse({ ok: true, ...result });
  }),
});

http.route({
  path: "/orangeslice/import",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authError = authorizeOutreachRequest(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const leads = await ctx.runQuery(internal.outreach.listPendingSheetLeads, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    const data = flatImportRows(leads);

    if (data.length > 0) {
      await ctx.runMutation(internal.outreach.ackSheetLeads, {
        householdIds: data.map((row) => row.household_id),
      });
    }

    const format = url.searchParams.get("format");
    if (format === "array") {
      return jsonResponse(data);
    }

    return jsonResponse({ ok: true, count: data.length, data });
  }),
});

http.route({
  path: "/orangeslice/leads",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authError = authorizeOutreachRequest(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const leads = await ctx.runQuery(internal.outreach.listPendingSheetLeads, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return jsonResponse({
      ok: true,
      count: leads.length,
      leads,
    });
  }),
});

http.route({
  path: "/orangeslice/ack",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authError = authorizeOutreachRequest(request);
    if (authError) return authError;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const householdIds = Array.isArray(body.household_ids)
      ? body.household_ids.filter((id): id is string => typeof id === "string")
      : Array.isArray(body.householdIds)
        ? body.householdIds.filter((id): id is string => typeof id === "string")
        : typeof body.household_id === "string"
          ? [body.household_id]
          : typeof body.householdId === "string"
            ? [body.householdId]
            : [];

    if (householdIds.length === 0) {
      return jsonResponse({ error: "household_ids required" }, 400);
    }

    const sheetRowIds =
      body.sheet_row_ids && typeof body.sheet_row_ids === "object"
        ? (body.sheet_row_ids as Record<string, string>)
        : body.sheetRowIds && typeof body.sheetRowIds === "object"
          ? (body.sheetRowIds as Record<string, string>)
          : undefined;

    const result = await ctx.runMutation(internal.outreach.ackSheetLeads, {
      householdIds,
      sheetRowIds,
    });

    return jsonResponse({ ok: true, ...result });
  }),
});

http.route({
  path: "/orangeslice/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authError = authorizeOutreachRequest(request);
    if (authError) return authError;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const householdId =
      (typeof body.householdId === "string" ? body.householdId : undefined) ??
      (typeof body.household_id === "string" ? body.household_id : undefined);

    if (!householdId) {
      return jsonResponse({ error: "householdId required" }, 400);
    }

    const allowedStatuses = new Set([
      "queued",
      "sheet_synced",
      "touch1_ready",
      "touch1_sent",
      "touch2_sent",
      "replied",
      "meeting",
      "won",
      "lost",
      "d2d_planned",
    ]);

    const statusRaw =
      typeof body.status === "string" ? body.status : undefined;
    const status =
      statusRaw && allowedStatuses.has(statusRaw)
        ? (statusRaw as
            | "queued"
            | "sheet_synced"
            | "touch1_ready"
            | "touch1_sent"
            | "touch2_sent"
            | "replied"
            | "meeting"
            | "won"
            | "lost"
            | "d2d_planned")
        : undefined;

    const result = await ctx.runMutation(internal.outreach.applySheetStatus, {
      householdId,
      status,
      sheetRowId:
        typeof body.sheetRowId === "string"
          ? body.sheetRowId
          : typeof body.row_id === "string"
            ? body.row_id
            : undefined,
      event: typeof body.event === "string" ? body.event : "sheet_webhook",
      detail: typeof body.detail === "string" ? body.detail : undefined,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      email:
        typeof body.email === "string"
          ? body.email
          : typeof body.primary_email === "string"
            ? body.primary_email
            : undefined,
      phone:
        typeof body.phone === "string"
          ? body.phone
          : typeof body.primary_phone === "string"
            ? body.primary_phone
            : undefined,
      linkedinUrl:
        typeof body.linkedinUrl === "string"
          ? body.linkedinUrl
          : typeof body.linkedin_url === "string"
            ? body.linkedin_url
            : undefined,
      emails: Array.isArray(body.emails)
        ? body.emails.filter((value): value is string => typeof value === "string")
        : undefined,
      phones: Array.isArray(body.phones)
        ? body.phones.filter((value): value is string => typeof value === "string")
        : undefined,
    });

    return jsonResponse({ ok: true, ...result });
  }),
});

export default http;
