"use node";

import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { chatCompletion } from "./lib/openai";
import { clusterLabel, type ServiceProfile, type VerticalScoreEntry } from "./lib/scoring";
import {
  buildPersonaTraits,
  PERSONA_TRAITS_VERSION,
  traitsPromptBlock,
} from "./lib/personaTraits";
import type { Id } from "./_generated/dataModel";

type LeadDoc = {
  householdId: string;
  clusterId: number;
  ownerOccupied: boolean;
  assessedValue: number;
  yearBuilt: number;
  lastSaleDate?: string;
  verticalScores: Record<string, VerticalScoreEntry>;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerFullName?: string;
  ownerContactRole?: "owner" | "resident" | "unknown";
  persona?: unknown;
  address: string;
};

function asDisplayText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asDisplayText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["text", "summary", "description", "content"]) {
      if (typeof obj[key] === "string") return (obj[key] as string).trim();
    }
  }
  return "";
}

function personaObjectionsForPrompt(value: unknown): string {
  if (Array.isArray(value)) return value.map(asDisplayText).filter(Boolean).join("; ");
  return asDisplayText(value);
}

function leadOwnerFullName(lead: LeadDoc): string | undefined {
  return lead.ownerFullName ?? (lead.ownerFirstName && lead.ownerLastName
    ? `${lead.ownerFirstName} ${lead.ownerLastName}`
    : undefined);
}

function traitsInput(lead: LeadDoc) {
  return {
    householdId: lead.householdId,
    clusterId: lead.clusterId,
    ownerOccupied: lead.ownerOccupied,
    assessedValue: lead.assessedValue,
    yearBuilt: lead.yearBuilt,
    lastSaleDate: lead.lastSaleDate,
    verticalScores: lead.verticalScores,
    ownerFullName: leadOwnerFullName(lead),
    ownerFirstName: lead.ownerFirstName,
    contactRole: lead.ownerContactRole,
  };
}

function cachedPersonaIsStale(persona: Record<string, unknown>, lead: LeadDoc): boolean {
  if (persona._traitsVersion !== PERSONA_TRAITS_VERSION) return true;
  const cachedOwner = persona._ownerFullName as string | undefined;
  const currentOwner = leadOwnerFullName(lead);
  if (currentOwner && cachedOwner !== currentOwner) return true;
  return false;
}

async function generatePersonaForLead(
  ctx: ActionCtx,
  sessionId: string,
  leadId: Id<"leads">,
  force = false,
): Promise<Record<string, unknown>> {
  const lead = (await ctx.runQuery(api.leads.getLead, { leadId })) as LeadDoc | null;
  if (!lead) throw new Error("Lead not found");

  const existing = lead.persona as Record<string, unknown> | undefined;
  if (existing && !force && !cachedPersonaIsStale(existing, lead)) {
    return existing;
  }

  const contractor = await ctx.runQuery(api.contractors.getContractor, {
    sessionId,
  });
  const serviceProfile = (contractor?.serviceProfile ?? null) as ServiceProfile | null;
  const traits = buildPersonaTraits(traitsInput(lead));
  const ownerName = leadOwnerFullName(lead);
  const contactRole = lead.ownerContactRole ?? (lead.ownerOccupied ? "owner" : "resident");
  const contactLabel =
    contactRole === "resident"
      ? "resident at"
      : contactRole === "owner"
        ? "homeowner at"
        : "person at";

  const prompt = `Generate a DISTINCT San Francisco household contact persona for contractor lead qualification.

${traitsPromptBlock(traits)}

Contractor services: ${serviceProfile?.service_types?.join(", ") ?? "home services"}
Contractor tier: ${serviceProfile?.price_point ?? "mid"}
Contractor notes: ${contractor?.businessDescription ?? "general residential contractor"}

Rules:
- Each household must feel UNIQUE. Do NOT reuse generic "wary and saving money" language unless budgetPosture explicitly says price-sensitive AND urgency is low.
- Match tone to communication style, decision style, and openness level above.
- If Identified contact is provided, the persona MUST describe THAT person — do not invent a different name, age, or gender that conflicts with the name.
- If contact is a resident (not owner-occupied), they may mention landlord, lease, or lack authority to approve work.
- Infer pronouns from the homeowner's first name when reasonable; never describe someone who could not be that named person.
- If no name is provided yet, do not invent a full name; use "I" voice without introducing yourself by name.
- High-income / urgent / recent-mover profiles should NOT sound like budget hoarders.
- Renters behave differently from owners (may defer, mention landlord, or lack authority).
- Objections must fit THIS profile (not generic "too expensive" every time).
- preferred_contractor_channel should align with the trait profile channel hint unless you have a specific reason not to.

Return JSON only with these keys (plain strings / string arrays only):
- summary: 2-3 sentences — specific personality, priorities, and attitude toward home projects
- likely_response_to_cold_approach: 1-2 sentences in their voice${ownerName ? ` (as ${ownerName.split(" ")[0]})` : ""}
- common_objections: array of 3 distinct objection strings tailored to this profile
- preferred_contractor_channel: short phrase
- conversion_hooks: 1-2 sentences on messaging that would actually move THIS household`;

  const raw = await chatCompletion(
    [
      {
        role: "system",
        content:
          "You create varied, data-grounded homeowner personas for SF residential contractors. When a homeowner name is given, the persona must match that person.",
      },
      { role: "user", content: prompt },
    ],
    { json: true, maxTokens: 900 },
  );

  let persona: Record<string, unknown>;
  try {
    persona = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse persona JSON from OpenAI");
  }

  persona._traitsVersion = PERSONA_TRAITS_VERSION;
  persona._traitProfile = traits;
  persona._ownerFullName = ownerName;

  await ctx.runMutation(internal.leads.patchLeadPersona, { leadId, persona });
  return persona;
}

export const generatePersona = action({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionId, leadId, force }): Promise<Record<string, unknown>> => {
    return await generatePersonaForLead(ctx, sessionId, leadId, force ?? false);
  },
});

export const sendChatMessage = action({
  args: {
    sessionId: v.string(),
    leadId: v.id("leads"),
    message: v.string(),
  },
  handler: async (
    ctx,
    { sessionId, leadId, message },
  ): Promise<{ reply: string }> => {
    const lead = (await ctx.runQuery(api.leads.getLead, { leadId })) as LeadDoc | null;
    if (!lead) throw new Error("Lead not found");

    const persona = await generatePersonaForLead(ctx, sessionId, leadId);
    const traits = buildPersonaTraits(traitsInput(lead));
    const ownerName = leadOwnerFullName(lead);
    const contactRole = lead.ownerContactRole ?? (lead.ownerOccupied ? "owner" : "resident");
    const contactLabel =
      contactRole === "resident"
        ? "resident at"
        : contactRole === "owner"
          ? "homeowner at"
          : "person at";

    const identity = ownerName
      ? `You are ${ownerName}, the ${contactLabel} ${lead.address} in San Francisco.`
      : `You are the ${contactLabel} ${lead.address} in San Francisco.`;

    const contractor = await ctx.runQuery(api.contractors.getContractor, {
      sessionId,
    });
    const serviceProfile = contractor?.serviceProfile as ServiceProfile | null;

    const history = await ctx.runQuery(api.chat.getChatHistory, {
      sessionId,
      leadId,
    });

    const systemPrompt = `${identity}
Segment: ${clusterLabel(lead.clusterId)}

${traitsPromptBlock(traits)}

Persona summary: ${asDisplayText(persona.summary)}
Cold-approach reaction: ${asDisplayText(persona.likely_response_to_cold_approach)}
Likely objections: ${personaObjectionsForPrompt(persona.common_objections)}
Conversion hooks: ${asDisplayText(persona.conversion_hooks)}
Preferred channel: ${asDisplayText(persona.preferred_contractor_channel) || traits.channelPreference}

A ${serviceProfile?.service_types?.join(", ") ?? "home services"} contractor is talking to you.
Stay in character as ${ownerName ?? "the person at this address"}. Do not claim a different name.
${contactRole === "resident" ? "You may not be the legal owner — reflect that if asked about approvals or budget." : ""}
Keep replies concise (2-4 sentences). Do not break the fourth wall.`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> =
      [{ role: "system", content: systemPrompt }];

    for (const turn of history) {
      messages.push({
        role: turn.role,
        content: turn.content,
      });
    }
    messages.push({ role: "user", content: message });

    const reply = await chatCompletion(messages, { maxTokens: 400 });

    await ctx.runMutation(internal.chat.appendChatTurn, {
      sessionId,
      leadId,
      userMessage: message,
      assistantMessage: reply,
    });

    return { reply };
  },
});
