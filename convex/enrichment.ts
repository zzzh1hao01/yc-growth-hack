"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  enrichHomeownerContact,
  type OwnerIdentity,
} from "./lib/orangeslice";
import { resolveOwnerFromAddress } from "./lib/ownerResolution";

type ContactInfo = {
  phone: string;
  email: string;
  name: string;
};

function cachedOwner(lead: {
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerFullName?: string;
  ownerLinkedInUrl?: string;
  ownerNameSource?: string;
  ownerContactRole?: "owner" | "resident" | "unknown";
}): Partial<OwnerIdentity> | undefined {
  if (!lead.ownerFirstName || !lead.ownerLastName) return undefined;
  return {
    firstName: lead.ownerFirstName,
    lastName: lead.ownerLastName,
    fullName: lead.ownerFullName ?? `${lead.ownerFirstName} ${lead.ownerLastName}`,
    linkedinUrl: lead.ownerLinkedInUrl,
    source: lead.ownerNameSource,
    contactRole: lead.ownerContactRole,
  };
}

function ownerLookupConfig() {
  const exaApiKey = process.env.EXA_API_KEY;
  const orangeSliceApiKey = process.env.ORANGE_SLICE_API_KEY;
  const orangeSliceEnabled = process.env.ORANGE_SLICE_ENABLED === "true";

  if (!exaApiKey && (!orangeSliceApiKey || !orangeSliceEnabled)) {
    throw new Error(
      "Owner lookup is not configured. Set EXA_API_KEY and/or ORANGE_SLICE_API_KEY in Convex.",
    );
  }

  return {
    exaApiKey,
    orangeSliceApiKey: orangeSliceEnabled ? orangeSliceApiKey : undefined,
  };
}

export const lookupOwnerName = action({
  args: {
    leadId: v.id("leads"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { leadId, force }): Promise<OwnerIdentity> => {
    const lead = await ctx.runQuery(api.leads.getLead, { leadId });
    if (!lead) throw new Error("Lead not found");

    const existing = cachedOwner(lead);
    if (!force && existing?.firstName && existing?.lastName) {
      return existing as OwnerIdentity;
    }

    const { exaApiKey, orangeSliceApiKey } = ownerLookupConfig();

    const owner = await resolveOwnerFromAddress({
      address: lead.address,
      householdId: lead.householdId,
      ownerOccupied: lead.ownerOccupied,
      exaApiKey,
      orangeSliceApiKey,
    });

    await ctx.runMutation(internal.leads.patchLeadOwner, {
      leadId,
      ownerFirstName: owner.firstName,
      ownerLastName: owner.lastName,
      ownerFullName: owner.fullName,
      ownerLinkedInUrl: owner.linkedinUrl,
      ownerNameSource: owner.source,
      ownerContactRole: owner.contactRole,
    });

    await ctx.runMutation(internal.leads.clearLeadPersona, { leadId });

    return owner;
  },
});

export const enrichContact = action({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
  },
  handler: async (ctx, { sessionId: _sessionId, leadId }): Promise<ContactInfo> => {
    const lead = await ctx.runQuery(api.leads.getLead, { leadId });
    if (!lead) throw new Error("Lead not found");

    if (lead.contactInfo) {
      return lead.contactInfo as ContactInfo;
    }

    const enabled = process.env.ORANGE_SLICE_ENABLED === "true";
    const orangeSliceApiKey = process.env.ORANGE_SLICE_API_KEY;
    const exaApiKey = process.env.EXA_API_KEY;

    let contactInfo: ContactInfo;
    let owner: OwnerIdentity | undefined;

    if (enabled && orangeSliceApiKey) {
      const result = await enrichHomeownerContact(
        orangeSliceApiKey,
        lead.address,
        cachedOwner(lead),
        lead.householdId,
        exaApiKey,
      );
      contactInfo = result.contact;
      owner = result.owner;

      if (!lead.ownerFirstName) {
        await ctx.runMutation(internal.leads.patchLeadOwner, {
          leadId,
          ownerFirstName: owner.firstName,
          ownerLastName: owner.lastName,
          ownerFullName: owner.fullName,
          ownerLinkedInUrl: owner.linkedinUrl,
          ownerNameSource: owner.source,
          ownerContactRole: owner.contactRole,
        });
        await ctx.runMutation(internal.leads.clearLeadPersona, { leadId });
      }
    } else {
      contactInfo = {
        name: "Homeowner (stub)",
        phone: "415-555-0100",
        email: `homeowner+${lead.householdId.replace(/[^a-zA-Z0-9]/g, "")}@example.com`,
      };
    }

    await ctx.runMutation(internal.leads.patchLeadContactInfo, {
      leadId,
      contactInfo,
    });

    return contactInfo;
  },
});
