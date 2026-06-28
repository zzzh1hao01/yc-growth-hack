"use node";

import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  enrichHomeownerContact,
  resolveOwnerWithAssessor,
  type OwnerIdentity,
} from "./lib/orangeslice";
import {
  isEnrichmentResult,
  normalizeStoredContactInfo,
  type EnrichmentContact,
  type EnrichmentResult,
} from "./lib/enrichmentTypes";
import { generateOutreachPlaybook, verticalEmailHook } from "./lib/playbook";

type LeadDoc = {
  householdId: string;
  address: string;
  ownerOccupied: boolean;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerFullName?: string;
  ownerLinkedInUrl?: string;
  ownerNameSource?: string;
  ownerContactRole?: "owner" | "resident" | "unknown";
  recordedOwnerFullName?: string;
  recordedOwnerSource?: string;
  contactInfo?: unknown;
  persona?: unknown;
  verticalScores?: Record<string, unknown>;
  replacementCostGapDollars?: number;
};

function cachedOwner(lead: LeadDoc): Partial<OwnerIdentity> | undefined {
  if (lead.ownerFirstName && lead.ownerLastName) {
    return {
      firstName: lead.ownerFirstName,
      lastName: lead.ownerLastName,
      fullName: lead.ownerFullName ?? `${lead.ownerFirstName} ${lead.ownerLastName}`,
      linkedinUrl: lead.ownerLinkedInUrl,
      source: lead.ownerNameSource,
      contactRole: lead.ownerContactRole,
    };
  }
  if (lead.recordedOwnerFullName) {
    const parts = lead.recordedOwnerFullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(" "),
        fullName: lead.recordedOwnerFullName,
        source: lead.recordedOwnerSource ?? "ingest",
        confidence: "high",
      };
    }
  }
  return undefined;
}

function ownerLookupConfig() {
  const exaApiKey = process.env.EXA_API_KEY;
  const orangeSliceApiKey = process.env.ORANGE_SLICE_API_KEY;
  const orangeSliceEnabled = process.env.ORANGE_SLICE_ENABLED === "true";

  if (!orangeSliceApiKey || !orangeSliceEnabled) {
    throw new Error(
      "Owner lookup requires ORANGE_SLICE_API_KEY and ORANGE_SLICE_ENABLED=true (web search via Orange Slice SERP). Exa is optional.",
    );
  }

  return {
    exaApiKey,
    orangeSliceApiKey,
  };
}

async function persistOwner(
  ctx: ActionCtx,
  leadId: Id<"leads">,
  owner: OwnerIdentity,
  ownerOccupied?: boolean,
) {
  await ctx.runMutation(internal.leads.patchLeadOwner, {
    leadId,
    ownerFirstName: owner.firstName,
    ownerLastName: owner.lastName,
    ownerFullName: owner.fullName,
    ownerLinkedInUrl: owner.linkedinUrl,
    ownerNameSource: owner.source,
    ownerContactRole: owner.contactRole,
    assessorBlock: owner.assessorParcel?.block,
    assessorLot: owner.assessorParcel?.lot,
    parcelNumber: owner.assessorParcel?.parcelNumber,
    ownerOccupied,
  });
  await ctx.runMutation(internal.leads.clearLeadPersona, { leadId });
}

async function runContactResolution(
  ctx: ActionCtx,
  sessionId: string,
  leadId: Id<"leads">,
  force = false,
): Promise<EnrichmentResult> {
  void sessionId;
  const lead = (await ctx.runQuery(api.leads.getLead, { leadId })) as LeadDoc | null;
  if (!lead) throw new Error("Lead not found");

  if (!force && lead.contactInfo) {
    const cached = normalizeStoredContactInfo(lead.contactInfo);
    if (cached && isEnrichmentResult(cached)) return cached;
  }

  const { exaApiKey, orangeSliceApiKey } = ownerLookupConfig();

  let owner = cachedOwner(lead) as OwnerIdentity | undefined;
  let ownerOccupied = lead.ownerOccupied;
  let assessorParcel = owner?.assessorParcel;

  if (!owner?.firstName || !owner?.lastName || force) {
    const resolved = await resolveOwnerWithAssessor({
      address: lead.address,
      householdId: lead.householdId,
      ownerOccupied: lead.ownerOccupied,
      exaApiKey,
      orangeSliceApiKey,
      recordedOwnerFullName: lead.recordedOwnerFullName,
      recordedOwnerSource: lead.recordedOwnerSource,
    });
    owner = resolved.owner;
    ownerOccupied = resolved.ownerOccupied;
    assessorParcel = resolved.assessorParcel ?? owner.assessorParcel;
    await persistOwner(ctx, leadId, owner, ownerOccupied);
  }

  const { contact, owner: enrichedOwner } = await enrichHomeownerContact(
    orangeSliceApiKey!,
    lead.address,
    owner,
    lead.householdId,
    exaApiKey,
    {
      fullName: lead.recordedOwnerFullName,
      source: lead.recordedOwnerSource,
    },
    ownerOccupied,
  );

  if (!lead.ownerFirstName || force) {
    await persistOwner(ctx, leadId, enrichedOwner, ownerOccupied);
  }

  const persona = lead.persona as Record<string, unknown> | undefined;
  const playbook = await generateOutreachPlaybook({
    address: lead.address,
    ownerOccupied,
    owner: enrichedOwner,
    contact,
    verticalHook:
      (lead.verticalScores
        ? verticalEmailHook(
            lead.verticalScores as Record<
              string,
              { urgency_flag?: boolean; reasons?: string[] }
            >,
          )
        : null) ??
      (lead.replacementCostGapDollars
        ? `Estimated $${Math.round(lead.replacementCostGapDollars / 1000)}k coverage gap vs rebuild cost.`
        : "Home coverage review — check if Coverage A keeps up with SF rebuild costs."),
    preferredChannel:
      typeof persona?.preferred_contractor_channel === "string"
        ? persona.preferred_contractor_channel
        : undefined,
  });

  const enrichment: EnrichmentResult = {
    owner: enrichedOwner,
    contact,
    playbook,
    assessorParcel: assessorParcel
      ? {
          block: assessorParcel.block,
          lot: assessorParcel.lot,
          parcelNumber: assessorParcel.parcelNumber,
        }
      : enrichedOwner.assessorParcel,
  };

  await ctx.runMutation(internal.leads.patchLeadContactInfo, {
    leadId,
    contactInfo: enrichment,
  });

  return enrichment;
}

export const lookupOwnerName = action({
  args: {
    leadId: v.id("leads"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { leadId, force }): Promise<OwnerIdentity> => {
    const lead = (await ctx.runQuery(api.leads.getLead, { leadId })) as LeadDoc | null;
    if (!lead) throw new Error("Lead not found");

    const existing = cachedOwner(lead);
    if (!force && existing?.firstName && existing?.lastName) {
      return existing as OwnerIdentity;
    }

    const { exaApiKey, orangeSliceApiKey } = ownerLookupConfig();
    const resolved = await resolveOwnerWithAssessor({
      address: lead.address,
      householdId: lead.householdId,
      ownerOccupied: lead.ownerOccupied,
      exaApiKey,
      orangeSliceApiKey,
      recordedOwnerFullName: lead.recordedOwnerFullName,
      recordedOwnerSource: lead.recordedOwnerSource,
    });

    await persistOwner(ctx, leadId, resolved.owner, resolved.ownerOccupied);
    return resolved.owner;
  },
});

export const resolveContactAndOutreach = action({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionId, leadId, force }): Promise<EnrichmentResult> => {
    return runContactResolution(ctx, sessionId, leadId, force);
  },
});

export const enrichContact = action({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
  },
  handler: async (ctx, { sessionId, leadId }): Promise<EnrichmentResult> => {
    return runContactResolution(ctx, sessionId, leadId, false);
  },
});
