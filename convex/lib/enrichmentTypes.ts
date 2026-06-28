import type { OwnerIdentity } from "./ownerResolution";

export type OutreachChannel = "email" | "phone" | "linkedin" | "mail" | "d2d";

export type EnrichmentContact = {
  emails: string[];
  phones: string[];
  linkedinUrl?: string;
  confidence: "high" | "medium" | "low";
  channels: OutreachChannel[];
  name: string;
  phone: string;
  email: string;
};

export type EnrichmentResult = {
  owner: OwnerIdentity;
  contact: EnrichmentContact;
  playbook: string;
  assessorParcel?: {
    block: string;
    lot: string;
    parcelNumber: string;
  };
};

export function buildChannels(contact: {
  emails: string[];
  phones: string[];
  linkedinUrl?: string;
}): OutreachChannel[] {
  const channels: OutreachChannel[] = [];
  if (contact.emails.length > 0) channels.push("email");
  if (contact.phones.length > 0) channels.push("phone");
  if (contact.linkedinUrl) channels.push("linkedin");
  channels.push("mail", "d2d");
  return channels;
}

export function contactConfidence(contact: {
  emails: string[];
  phones: string[];
  linkedinUrl?: string;
}): "high" | "medium" | "low" {
  if (contact.emails.length > 0 && contact.phones.length > 0) return "high";
  if (contact.emails.length > 0 || contact.phones.length > 0) return "medium";
  if (contact.linkedinUrl) return "medium";
  return "low";
}

export function legacyContactFields(
  name: string,
  emails: string[],
  phones: string[],
): { name: string; phone: string; email: string } {
  return {
    name,
    phone: phones[0] ?? "Not found",
    email: emails[0] ?? "Not found",
  };
}

export function isEnrichmentResult(value: unknown): value is EnrichmentResult {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return Boolean(obj.owner && obj.contact && typeof obj.playbook === "string");
}

const PLACEHOLDER_OWNER_NAMES = new Set([
  "property owner",
  "homeowner",
  "owner",
  "san francisco homeowner",
]);

export function isPlaceholderOwner(owner: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  source?: string;
}): boolean {
  const full = (
    owner.fullName ?? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`
  )
    .trim()
    .toLowerCase();
  if (PLACEHOLDER_OWNER_NAMES.has(full)) return true;
  if (owner.source === "unresolved" || owner.source === "datasf_parcel_only") {
    return true;
  }
  return false;
}

export function isWeakEnrichment(result: EnrichmentResult): boolean {
  const { contact } = result;
  return (
    contact.confidence === "low" &&
    contact.emails.length === 0 &&
    contact.phones.length === 0 &&
    !contact.linkedinUrl
  );
}

export function mergeContactFields(
  existing: EnrichmentResult | null,
  incoming: {
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    emails?: string[];
    phones?: string[];
  },
): EnrichmentResult | null {
  const emails = [
    ...(incoming.emails ?? []),
    ...(incoming.email ? [incoming.email] : []),
  ].filter(Boolean);
  const phones = [
    ...(incoming.phones ?? []),
    ...(incoming.phone ? [incoming.phone] : []),
  ].filter(Boolean);
  const linkedinUrl = incoming.linkedinUrl ?? existing?.contact.linkedinUrl;

  if (emails.length === 0 && phones.length === 0 && !linkedinUrl) {
    return existing;
  }

  const owner = existing?.owner ?? {
    firstName: "",
    lastName: "",
    fullName: "",
    source: "sheet_sync",
  };
  const uniqueEmails = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
  const uniquePhones = [...new Set(phones.map((p) => p.trim()).filter(Boolean))];
  const contact: EnrichmentContact = {
    emails: uniqueEmails,
    phones: uniquePhones,
    linkedinUrl,
    confidence: contactConfidence({
      emails: uniqueEmails,
      phones: uniquePhones,
      linkedinUrl,
    }),
    channels: buildChannels({
      emails: uniqueEmails,
      phones: uniquePhones,
      linkedinUrl,
    }),
    ...legacyContactFields(
      owner.fullName || "Homeowner",
      uniqueEmails,
      uniquePhones,
    ),
  };

  return {
    owner: linkedinUrl ? { ...owner, linkedinUrl } : owner,
    contact,
    playbook: existing?.playbook ?? "",
    assessorParcel: existing?.assessorParcel,
  };
}

export function normalizeStoredContactInfo(value: unknown): EnrichmentResult | null {
  if (!value || typeof value !== "object") return null;
  if (isEnrichmentResult(value)) return value;

  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== "string") return null;

  const emails =
    Array.isArray(obj.emails) && obj.emails.length > 0
      ? (obj.emails as string[])
      : obj.email && obj.email !== "Not found"
        ? [obj.email as string]
        : [];
  const phones =
    Array.isArray(obj.phones) && obj.phones.length > 0
      ? (obj.phones as string[])
      : obj.phone && obj.phone !== "Not found"
        ? [obj.phone as string]
        : [];

  const contact: EnrichmentContact = {
    emails,
    phones,
    linkedinUrl: typeof obj.linkedinUrl === "string" ? obj.linkedinUrl : undefined,
    confidence: contactConfidence({ emails, phones, linkedinUrl: obj.linkedinUrl as string }),
    channels: buildChannels({ emails, phones, linkedinUrl: obj.linkedinUrl as string }),
    ...legacyContactFields(obj.name as string, emails, phones),
  };

  return {
    owner: {
      firstName: "",
      lastName: "",
      fullName: obj.name as string,
      source: "cached",
    },
    contact,
    playbook: typeof obj.playbook === "string" ? obj.playbook : "",
  };
}
