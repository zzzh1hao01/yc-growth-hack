"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  DEFAULT_CAMPAIGNS,
  pickCampaign,
  renderTemplate,
} from "./lib/campaigns";
import type { EnrichmentResult } from "./lib/enrichmentTypes";
import {
  buildChannels,
  isEnrichmentResult,
  normalizeStoredContactInfo,
} from "./lib/enrichmentTypes";
import {
  orangeSliceSheetUrl,
  pushLeadToOrangeSliceSheet,
} from "./lib/orangesliceSheet";
import { verticalEmailHook } from "./lib/playbook";
import { pickVertical, type ServiceProfile } from "./lib/scoring";

type LeadDoc = {
  householdId: string;
  address: string;
  ownerOccupied: boolean;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerFullName?: string;
  recordedOwnerFullName?: string;
  recordedOwnerSource?: string;
  parcelNumber?: string;
  assessorBlock?: string;
  assessorLot?: string;
  contactInfo?: unknown;
  persona?: unknown;
  verticalScores?: Record<string, unknown>;
  replacementCostGapDollars?: number;
  needScore?: number;
};

type ContractorDoc = {
  name: string;
  businessName?: string;
  businessDescription: string;
  serviceProfile?: { service_types?: string[] };
};

function primaryChannel(enrichment: EnrichmentResult) {
  if (enrichment.contact.emails.length > 0) return "email" as const;
  if (enrichment.contact.phones.length > 0) return "phone" as const;
  if (enrichment.contact.linkedinUrl) return "linkedin" as const;
  return "d2d" as const;
}

function buildFallbackEnrichment(
  lead: LeadDoc,
  vertical: string,
): EnrichmentResult {
  const fullName =
    lead.recordedOwnerFullName ??
    lead.ownerFullName ??
    (lead.ownerFirstName && lead.ownerLastName
      ? `${lead.ownerFirstName} ${lead.ownerLastName}`
      : "Homeowner");
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = lead.ownerFirstName ?? parts[0] ?? "there";
  const lastName = lead.ownerLastName ?? parts.slice(1).join(" ") ?? "";
  const hook =
    (lead.verticalScores
      ? verticalEmailHook(
          lead.verticalScores as Record<
            string,
            { urgency_flag?: boolean; reasons?: string[] }
          >,
        )
      : null) ??
    (lead.replacementCostGapDollars
      ? `Estimated $${Math.round(lead.replacementCostGapDollars / 1000)}k+ coverage gap vs rebuild cost.`
      : "We offer complimentary home coverage reviews for SF homeowners.");

  const contact = {
    emails: [] as string[],
    phones: [] as string[],
    confidence: "low" as const,
    channels: buildChannels({ emails: [], phones: [] }),
    name: fullName,
    phone: "Not found",
    email: "Not found",
  };

  return {
    owner: {
      firstName,
      lastName,
      fullName,
      source: lead.recordedOwnerSource ?? "pipeline_fallback",
      contactRole: lead.ownerOccupied ? "owner" : "resident",
      assessorParcel:
        lead.assessorBlock && lead.assessorLot
          ? {
              block: lead.assessorBlock,
              lot: lead.assessorLot,
              parcelNumber: lead.parcelNumber ?? `${lead.assessorBlock}-${lead.assessorLot}`,
            }
          : undefined,
    },
    contact,
    playbook: `No email/phone in app yet — Orange Slice sheet should run contact waterfall, then door knock or mail at ${lead.address}. ${hook}`,
  };
}

function templateVars(
  lead: LeadDoc,
  contractor: ContractorDoc,
  enrichment: EnrichmentResult,
  vertical: string,
): Record<string, string> {
  const ownerFirst =
    enrichment.owner.firstName ||
    lead.ownerFirstName ||
    enrichment.owner.fullName.split(/\s+/)[0] ||
    "there";
  const ownerLast =
    enrichment.owner.lastName ||
    lead.ownerLastName ||
    enrichment.owner.fullName.split(/\s+/).slice(1).join(" ") ||
    "";

  const persona = lead.persona as Record<string, unknown> | undefined;
  const personaHook =
    (typeof persona?.likely_response_to_cold_approach === "string"
      ? persona.likely_response_to_cold_approach
      : undefined) ?? enrichment.playbook.slice(0, 160);

  return {
    owner_first_name: ownerFirst,
    owner_last_name: ownerLast,
    owner_full_name: enrichment.owner.fullName,
    address: lead.address,
    contractor_name: contractor.name,
    contractor_business: contractor.businessName ?? contractor.name,
    vertical,
    vertical_hook:
      (lead.verticalScores
        ? verticalEmailHook(
            lead.verticalScores as Record<
              string,
              { urgency_flag?: boolean; reasons?: string[] }
            >,
          )
        : null) ??
      (lead.replacementCostGapDollars
        ? `Coverage may lag rebuild cost by ~$${Math.round(lead.replacementCostGapDollars / 1000)}k.`
        : "Complimentary coverage review for SF homeowners."),
    persona_hook: personaHook,
    meeting_window: "this week or next",
  };
}

export const listCampaigns = action({
  args: {},
  handler: async (): Promise<typeof DEFAULT_CAMPAIGNS> => DEFAULT_CAMPAIGNS,
});

export const startOutreach = action({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
    campaignSlug: v.optional(v.string()),
    forceEnrichment: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { sessionId, leadId, campaignSlug, forceEnrichment },
  ): Promise<{
    status:
      | "queued"
      | "sheet_synced"
      | "touch1_ready"
      | "touch1_sent"
      | "touch2_sent"
      | "replied"
      | "meeting"
      | "won"
      | "lost"
      | "d2d_planned";
    primaryChannel: "email" | "phone" | "linkedin" | "mail" | "d2d";
    campaignSlug: string;
    sheetSynced: boolean;
    sheetRowId?: string;
    sheetError?: string;
    sheetUrl: string | null;
    touch1: { subject: string; body: string; mailto?: string };
    touch2: { subject: string; body: string };
    enrichment: EnrichmentResult;
  }> => {
    const lead = (await ctx.runQuery(api.leads.getLead, { leadId })) as LeadDoc | null;
    if (!lead) throw new Error("Lead not found");

    const contractor = (await ctx.runQuery(api.contractors.getContractor, {
      sessionId,
    })) as ContractorDoc | null;
    if (!contractor) throw new Error("Complete onboarding first");

    let enrichment: EnrichmentResult | null = null;
    if (!forceEnrichment && lead.contactInfo) {
      enrichment =
        normalizeStoredContactInfo(lead.contactInfo) ??
        (isEnrichmentResult(lead.contactInfo) ? lead.contactInfo : null);
    }

    if (!enrichment || forceEnrichment) {
      enrichment = await ctx.runAction(api.enrichment.resolveContactAndOutreach, {
        sessionId,
        leadId,
        force: Boolean(forceEnrichment),
      });
    }

    const vertical = pickVertical(
      (contractor.serviceProfile as ServiceProfile | null | undefined) ?? null,
    );

    if (!enrichment) {
      enrichment = buildFallbackEnrichment(lead, vertical);
    }

    if (!enrichment) {
      throw new Error("Could not resolve contact for outreach");
    }

    const vs = lead.verticalScores?.[vertical] as { score?: number } | undefined;
    const matchScore = typeof vs?.score === "number" ? Math.round(vs.score) : 0;
    const campaign = pickCampaign(DEFAULT_CAMPAIGNS, campaignSlug);
    const vars = templateVars(lead, contractor, enrichment, vertical);
    const touch1Subject = renderTemplate(campaign.touch1Subject, vars);
    const touch1Body = renderTemplate(campaign.touch1Body, vars);
    const touch2Subject = renderTemplate(campaign.touch2Subject, vars);
    const touch2Body = renderTemplate(campaign.touch2Body, vars);

    const sheetPayload = {
      household_id: lead.householdId,
      convex_lead_id: String(leadId),
      session_id: sessionId,
      address: lead.address,
      owner_name: enrichment.owner.fullName,
      owner_first_name: vars.owner_first_name,
      owner_last_name: vars.owner_last_name,
      match_score: matchScore,
      vertical,
      vertical_hook: vars.vertical_hook,
      persona_hook: vars.persona_hook,
      contractor_name: contractor.name,
      contractor_business: vars.contractor_business,
      emails: enrichment.contact.emails,
      phones: enrichment.contact.phones,
      linkedin_url: enrichment.contact.linkedinUrl,
      playbook: enrichment.playbook,
      channels: enrichment.contact.channels,
      status: "queued",
      campaign_slug: campaign.slug,
      touch1_subject: touch1Subject,
      touch1_body: touch1Body,
      touch2_subject: touch2Subject,
      touch2_body: touch2Body,
      recorded_owner_source: lead.recordedOwnerSource,
      parcel_number: lead.parcelNumber,
      city: "San Francisco",
      state: "CA",
    };

    const sheetPush = await pushLeadToOrangeSliceSheet(
      sheetPayload,
      await ctx.runQuery(internal.pipelineConfig.getSheetWebhookUrl, {}),
    );
    const channel = primaryChannel(enrichment);
    const pipelineStatus = sheetPush.synced ? ("sheet_synced" as const) : ("queued" as const);

    await ctx.runMutation(internal.outreach.createOutreachRecord, {
      sessionId,
      leadId,
      householdId: lead.householdId,
      status: pipelineStatus,
      primaryChannel: channel,
      campaignSlug: campaign.slug,
      enrichmentSnapshot: enrichment,
      sheetPayload,
      sheetRowId: sheetPush.rowId,
      sheetSyncedAt: sheetPush.synced ? Date.now() : undefined,
      event: sheetPush.synced ? "sheet_synced" : "pipeline_queued",
      detail:
        sheetPush.error ??
        (sheetPush.synced ? sheetPush.rowId : "awaiting_orangeslice_import"),
    });

    const mailto: string | undefined =
      enrichment.contact.emails[0] != null
        ? `mailto:${encodeURIComponent(enrichment.contact.emails[0])}?subject=${encodeURIComponent(touch1Subject)}&body=${encodeURIComponent(touch1Body)}`
        : undefined;

    return {
      status: pipelineStatus,
      primaryChannel: channel,
      campaignSlug: campaign.slug,
      sheetSynced: sheetPush.synced,
      sheetRowId: sheetPush.rowId,
      sheetError: sheetPush.error,
      sheetUrl: orangeSliceSheetUrl() ?? null,
      touch1: { subject: touch1Subject, body: touch1Body, mailto },
      touch2: { subject: touch2Subject, body: touch2Body },
      enrichment,
    };
  },
});

export const logTouchSent = action({
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
  handler: async (ctx, args): Promise<{ updated: boolean }> => {
    return await ctx.runMutation(internal.outreach.markTouchSent, args);
  },
});
