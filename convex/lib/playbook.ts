import { chatCompletion } from "./openai";
import type { EnrichmentContact } from "./enrichmentTypes";
import type { OwnerIdentity } from "./ownerResolution";

type PlaybookContext = {
  address: string;
  ownerOccupied: boolean;
  owner: OwnerIdentity;
  contact: EnrichmentContact;
  verticalHook?: string;
  preferredChannel?: string;
};

function fallbackPlaybook(ctx: PlaybookContext): string {
  const lines: string[] = [];
  if (ctx.verticalHook) lines.push(ctx.verticalHook);

  if (ctx.contact.channels.includes("email")) {
    lines.push(`Email ${ctx.contact.emails[0]} with a property-specific hook for ${ctx.address}.`);
  }
  if (ctx.contact.channels.includes("phone")) {
    lines.push(`Call ${ctx.contact.phones[0]} and offer a complimentary coverage review.`);
  }
  if (ctx.contact.channels.includes("d2d")) {
    lines.push(`Door knock at ${ctx.address}${ctx.owner.fullName ? ` — ask for ${ctx.owner.fullName}` : ""}.`);
  }
  if (ctx.contact.channels.includes("mail")) {
    lines.push(`Mail a postcard to ${ctx.address} with a coverage review offer.`);
  }

  return lines.length > 0
    ? lines.join(" ")
    : `Visit ${ctx.address} in person — no digital contact found.`;
}

export async function generateOutreachPlaybook(ctx: PlaybookContext): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return fallbackPlaybook(ctx);

  try {
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content:
            "Write a 2-4 sentence outreach playbook for an SF insurance agent reaching a homeowner about coverage review. Be specific about channel order.",
        },
        {
          role: "user",
          content: `Address: ${ctx.address}
Contact: ${ctx.owner.fullName} (${ctx.owner.contactRole ?? "unknown"})
Channels: ${ctx.contact.channels.join(", ")}
Emails: ${ctx.contact.emails.join(", ") || "none"}
Phones: ${ctx.contact.phones.join(", ") || "none"}
${ctx.verticalHook ? `Hook: ${ctx.verticalHook}` : ""}
${ctx.preferredChannel ? `Persona prefers: ${ctx.preferredChannel}` : ""}`,
        },
      ],
      { maxTokens: 220 },
    );
    return raw.trim() || fallbackPlaybook(ctx);
  } catch {
    return fallbackPlaybook(ctx);
  }
}

export function verticalEmailHook(
  verticalScores: Record<
    string,
    { urgency_flag?: boolean; last_relevant_permit_date?: string | null; reasons?: string[] }
  >,
): string | undefined {
  const hvac = verticalScores.hvac;
  if (hvac?.urgency_flag) {
    return "Your home may be due for an HVAC check — we offer a free system inspection.";
  }
  const panel = verticalScores.panel;
  if (panel?.urgency_flag) {
    return "Older SF homes often need panel upgrades before EV installs — free assessment available.";
  }
  return hvac?.reasons?.[0] ?? panel?.reasons?.[0];
}
