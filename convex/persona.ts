"use node";

import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { chatCompletion } from "./lib/openai";
import { type AgentProfile } from "./lib/scoring";
import {
  buildPersonaTraits,
  PERSONA_TRAITS_VERSION,
  traitsPromptBlock,
} from "./lib/personaTraits";
import type { Id } from "./_generated/dataModel";

type LeadDoc = {
  householdId: string;
  ownerOccupied: boolean;
  yearBuilt?: number;
  yearsOwned?: number;
  purchaseYear?: number;
  needScore: number;
  timingScore: number;
  timingConfidence: "high" | "low" | "none";
  replacementCostGapPct: number;
  replacementCostGapDollars: number;
  replacementCostToday: number;
  worthOutreach: boolean;
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
    ownerOccupied: lead.ownerOccupied,
    yearBuilt: lead.yearBuilt,
    yearsOwned: lead.yearsOwned,
    purchaseYear: lead.purchaseYear,
    needScore: lead.needScore,
    timingScore: lead.timingScore,
    timingConfidence: lead.timingConfidence,
    replacementCostGapPct: lead.replacementCostGapPct,
    replacementCostGapDollars: lead.replacementCostGapDollars,
    replacementCostToday: lead.replacementCostToday,
    worthOutreach: lead.worthOutreach,
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

  const agent = await ctx.runQuery(api.contractors.getContractor, { sessionId });
  const agentProfile = (agent?.serviceProfile ?? null) as AgentProfile | null;
  const traits = buildPersonaTraits(traitsInput(lead));
  const ownerName = leadOwnerFullName(lead);
  const contactRole = lead.ownerContactRole ?? (lead.ownerOccupied ? "owner" : "resident");
  const contactLabel =
    contactRole === "resident"
      ? "resident at"
      : contactRole === "owner"
        ? "homeowner at"
        : "person at";

  const prompt = `Generate a DISTINCT San Francisco homeowner persona for insurance agent lead qualification.

${traitsPromptBlock(traits)}

Agent lines of business: ${agentProfile?.lines_of_business?.join(", ") ?? "home insurance"}
Agent tier: ${agentProfile?.price_point ?? "mid"}
Agent notes: ${agent?.businessDescription ?? "independent insurance advisor"}

Rules:
- Each household must feel UNIQUE — grounded in the coverage gap and tenure signals above.
- Persona is a HOMEOWNER evaluating a coverage review, not a contractor lead.
- If Identified contact is provided, the persona MUST describe THAT person.
- Infer pronouns from the homeowner's first name when reasonable.
- Objections should be insurance-specific (premium hikes, loyalty to current carrier, confusion about Coverage A, etc.).
- preferred_contact_channel should align with the trait profile channel hint.
- Do NOT reference HVAC, permits, or contractor services.

Return JSON only with these keys (plain strings / string arrays only):
- summary: 2-3 sentences — attitude toward insurance, coverage awareness, and openness to review
- likely_response_to_cold_approach: 1-2 sentences in their voice${ownerName ? ` (as ${ownerName.split(" ")[0]})` : ""}
- common_objections: array of 3 distinct insurance-specific objection strings
- preferred_contact_channel: short phrase
- conversion_hooks: 1-2 sentences on messaging that would move THIS household toward a coverage review`;

  const raw = await chatCompletion(
    [
      {
        role: "system",
        content:
          "You create varied, data-grounded SF homeowner personas for insurance coverage review outreach. When a homeowner name is given, the persona must match that person.",
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

    const agent = await ctx.runQuery(api.contractors.getContractor, { sessionId });
    const agentProfile = agent?.serviceProfile as AgentProfile | null;

    const history = await ctx.runQuery(api.chat.getChatHistory, {
      sessionId,
      leadId,
    });

    const systemPrompt = `${identity}
Profile: ${traits.segmentLabel}

${traitsPromptBlock(traits)}

Persona summary: ${asDisplayText(persona.summary)}
Cold-approach reaction: ${asDisplayText(persona.likely_response_to_cold_approach)}
Likely objections: ${personaObjectionsForPrompt(persona.common_objections)}
Conversion hooks: ${asDisplayText(persona.conversion_hooks)}
Preferred channel: ${asDisplayText(persona.preferred_contact_channel) || traits.channelPreference}

An insurance agent (${agentProfile?.lines_of_business?.join(", ") ?? "home insurance"}) is talking to you about a coverage review.
Stay in character as ${ownerName ?? "the person at this address"}. Do not claim a different name.
${contactRole === "resident" ? "You may not be the legal owner — reflect that if asked about policy decisions." : ""}
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
