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
  isPlaceholderOwner,
  isWeakEnrichment,
  normalizeStoredContactInfo,
  type EnrichmentContact,
  type EnrichmentResult,
} from "./lib/enrichmentTypes";
import { coverageEmailHook } from "./lib/coverageHooks";
import { sanitizeEnrichmentContact } from "./lib/homeownerEmail";
import { generateOutreachPlaybook } from "./lib/playbook";

type LeadDoc = {
  householdId: string;
  address: string;
  neighborhood?: string;
  ownerOccupied: boolean;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerFullName?: string;
  ownerLinkedInUrl?: string;
  ownerNameSource?: string;
  ownerContactRole?: "owner" | "resident" | "unknown";
  recordedOwnerFullName?: string;
  recordedOwnerSource?: string;
  parcelNumber?: string;
  yearBuilt?: number;
  contactInfo?: unknown;
  persona?: unknown;
  replacementCostGapDollars?: number;
  replacementCostGapPct?: number;
  needScore?: number;
  timingScore?: number;
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
  const orangeSlice =
    orangeSliceApiKey && orangeSliceEnabled ? orangeSliceApiKey : undefined;

  if (!exaApiKey && !orangeSlice) {
    throw new Error(
      "Contact enrichment requires EXA_API_KEY and/or ORANGE_SLICE_API_KEY with ORANGE_SLICE_ENABLED=true.",
    );
  }

  return {
    exaApiKey,
    orangeSliceApiKey: orangeSlice,
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
    if (cached && isEnrichmentResult(cached) && !isWeakEnrichment(cached)) {
      return cached;
    }
  }

  const { exaApiKey, orangeSliceApiKey } = ownerLookupConfig();

  let owner = cachedOwner(lead) as OwnerIdentity | undefined;
  let ownerOccupied = lead.ownerOccupied;
  let assessorParcel = owner?.assessorParcel;

  const needsOwnerResolution =
    force ||
    !owner?.firstName ||
    !owner?.lastName ||
    isPlaceholderOwner(owner ?? {});

  if (needsOwnerResolution) {
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

  const { contact: rawContact, owner: enrichedOwner } = await enrichHomeownerContact(
    orangeSliceApiKey,
    lead.address,
    owner,
    lead.householdId,
    exaApiKey,
    {
      fullName: lead.recordedOwnerFullName,
      source: lead.recordedOwnerSource,
    },
    ownerOccupied,
    {
      neighborhood: lead.neighborhood,
      parcelNumber: lead.parcelNumber ?? assessorParcel?.parcelNumber,
      yearBuilt: lead.yearBuilt,
    },
  );

  const contact = await sanitizeEnrichmentContact(rawContact, enrichedOwner);

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
      coverageEmailHook({
        replacementCostGapDollars: lead.replacementCostGapDollars,
        replacementCostGapPct: lead.replacementCostGapPct,
        needScore: lead.needScore,
        timingScore: lead.timingScore,
      }),
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

  if (!isWeakEnrichment(enrichment)) {
    await ctx.runMutation(internal.leads.patchLeadContactInfo, {
      leadId,
      contactInfo: enrichment,
    });
  }

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
    if (!force && existing?.firstName && existing?.lastName && !isPlaceholderOwner(existing)) {
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
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionId, leadId, force }): Promise<EnrichmentResult> => {
    return runContactResolution(ctx, sessionId, leadId, force ?? false);
  },
});

/** Resolve email / phone / LinkedIn from gathered household + owner data. */
export const enrichContactFromLead = action({
  args: {
    leadId: v.id("leads"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { leadId, force }): Promise<EnrichmentResult> => {
    return runContactResolution(ctx, "", leadId, force ?? false);
  },
});
