"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { resolveOwnerWithAssessor } from "./lib/ownerResolution";

function parseName(fullName: string): { firstName?: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return {};
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

type LeadListItem = {
  convexId?: string;
  recordedOwnerFullName?: string;
  id: string;
};

/**
 * Interim batch job when assessor CSV is not yet available.
 * Resolves owner names via DataSF parcel + Orange Slice web search and
 * persists them as recordedOwnerFullName for reliable reuse.
 */
export const batchResolveRecordedOwners = action({
  args: {
    force: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { force, limit },
  ): Promise<{
    resolved: number;
    skipped: number;
    attempted: number;
    errors: string[];
  }> => {
    const orangeSliceApiKey = process.env.ORANGE_SLICE_API_KEY;
    const orangeSliceEnabled = process.env.ORANGE_SLICE_ENABLED === "true";
    if (!orangeSliceApiKey || !orangeSliceEnabled) {
      throw new Error("Set ORANGE_SLICE_API_KEY and ORANGE_SLICE_ENABLED=true");
    }

    const exaApiKey = process.env.EXA_API_KEY;
    const allLeads = (await ctx.runQuery(api.leads.listLeads, {})) as LeadListItem[];
    const targets = (limit ? allLeads.slice(0, limit) : allLeads).filter(
      (lead: LeadListItem) => force || !lead.recordedOwnerFullName,
    );

    let resolved = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const leadView of targets) {
      const leadId = leadView.convexId as Id<"leads"> | undefined;
      if (!leadId) continue;

      const lead = await ctx.runQuery(api.leads.getLead, { leadId });
      if (!lead) continue;

      if (!force && lead.recordedOwnerFullName) {
        skipped += 1;
        continue;
      }

      try {
        const result = await resolveOwnerWithAssessor({
          address: lead.address,
          householdId: lead.householdId,
          ownerOccupied: lead.ownerOccupied,
          exaApiKey,
          orangeSliceApiKey,
          recordedOwnerFullName: force ? undefined : lead.recordedOwnerFullName,
          recordedOwnerSource: lead.recordedOwnerSource,
        });

        const { firstName, lastName } = parseName(result.owner.fullName);
        const source =
          result.owner.source.includes("ingest") || result.owner.source.includes("assessor")
            ? result.owner.source
            : `web_batch:${result.owner.source}`;

        await ctx.runMutation(internal.leads.patchLeadOwner, {
          leadId,
          ownerFirstName: result.owner.firstName,
          ownerLastName: result.owner.lastName,
          ownerFullName: result.owner.fullName,
          ownerLinkedInUrl: result.owner.linkedinUrl,
          ownerNameSource: source,
          ownerContactRole: result.owner.contactRole ?? "owner",
          assessorBlock: result.owner.assessorParcel?.block,
          assessorLot: result.owner.assessorParcel?.lot,
          parcelNumber: result.owner.assessorParcel?.parcelNumber,
          ownerOccupied: result.ownerOccupied,
        });

        await ctx.runMutation(internal.seed.patchRecordedOwner, {
          leadId,
          recordedOwnerFullName: result.owner.fullName,
          recordedOwnerSource: source,
          ownerFirstName: firstName,
          ownerLastName: lastName,
        });

        resolved += 1;
      } catch (err) {
        errors.push(
          `${lead.householdId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      resolved,
      skipped,
      attempted: targets.length,
      errors: errors.slice(0, 10),
    };
  },
});
