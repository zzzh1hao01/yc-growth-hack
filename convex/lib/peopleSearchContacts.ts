import { chatCompletion } from "./openai";
import { exaSearch, formatExaResults } from "./exa";
import {
  buildChannels,
  contactConfidence,
  isPlaceholderOwner,
  legacyContactFields,
  type EnrichmentContact,
} from "./enrichmentTypes";
import type { OwnerIdentity } from "./ownerResolution";

const PEOPLE_DOMAINS = [
  "truepeoplesearch.com",
  "fastpeoplesearch.com",
  "whitepages.com",
  "spokeo.com",
  "beenverified.com",
  "radaris.com",
  "411.com",
  "anywho.com",
  "usphonebook.com",
];

const JUNK_EMAIL_DOMAINS = new Set([
  "example.com",
  "email.com",
  "domain.com",
  "test.com",
  "sentry.io",
]);

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE =
  /(?:\+?1[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function isUsableEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1];
  if (!domain || JUNK_EMAIL_DOMAINS.has(domain)) return false;
  if (lower.includes("noreply") || lower.includes("no-reply")) return false;
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(domain)) return false;
  if (
    /^(support|info|help|admin|contact|sales|noreply|no-reply|privacy|legal)@/i.test(
      lower,
    )
  ) {
    return false;
  }
  return true;
}

export function extractContactsFromText(text: string): {
  emails: string[];
  phones: string[];
} {
  const emails = uniqueStrings(
    (text.match(EMAIL_RE) ?? []).filter(isUsableEmail),
  );
  const phones = uniqueStrings(
    (text.match(PHONE_RE) ?? [])
      .map(normalizePhone)
      .filter((phone): phone is string => Boolean(phone)),
  );
  return { emails, phones };
}

function buildContact(
  owner: OwnerIdentity,
  emails: string[],
  phones: string[],
  linkedinUrl?: string,
): EnrichmentContact | null {
  if (emails.length === 0 && phones.length === 0 && !linkedinUrl) return null;
  return {
    emails,
    phones,
    linkedinUrl,
    confidence: contactConfidence({ emails, phones, linkedinUrl }),
    channels: buildChannels({ emails, phones, linkedinUrl }),
    ...legacyContactFields(owner.fullName, emails, phones),
  };
}

function mergeContacts(
  owner: OwnerIdentity,
  contacts: Array<EnrichmentContact | null>,
): EnrichmentContact | null {
  const emails: string[] = [];
  const phones: string[] = [];
  let linkedinUrl: string | undefined;

  for (const contact of contacts) {
    if (!contact) continue;
    emails.push(...contact.emails);
    phones.push(...contact.phones);
    linkedinUrl ??= contact.linkedinUrl;
  }

  return buildContact(
    owner,
    uniqueStrings(emails),
    uniqueStrings(phones),
    linkedinUrl ?? owner.linkedinUrl,
  );
}

async function gptExtractContacts(
  owner: OwnerIdentity,
  address: string,
  evidence: string,
): Promise<{ emails: string[]; phones: string[] }> {
  if (!process.env.OPENAI_API_KEY || evidence.trim().length < 80) {
    return { emails: [], phones: [] };
  }

  try {
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content:
            "Extract personal contact info for a San Francisco homeowner from web search snippets. Return JSON only: { emails: string[], phones: string[] }. Use US E.164 phones (+1...). Only include personal emails (gmail, yahoo, icloud, etc.) that plausibly belong to the named person — never site/support/info addresses, never directory-site emails, never guessed addresses. Empty arrays if unsure.",
        },
        {
          role: "user",
          content: `Person: ${owner.fullName}\nAddress: ${address}\n\nSnippets:\n${evidence.slice(0, 12000)}`,
        },
      ],
      { json: true, maxTokens: 300 },
    );
    const parsed = JSON.parse(raw) as { emails?: string[]; phones?: string[] };
    const emails = uniqueStrings((parsed.emails ?? []).filter(isUsableEmail));
    const phones = uniqueStrings(
      (parsed.phones ?? [])
        .map(normalizePhone)
        .filter((phone): phone is string => Boolean(phone)),
    );
    return { emails, phones };
  } catch {
    return { emails: [], phones: [] };
  }
}

export async function findContactsViaPeopleSearch(
  exaApiKey: string,
  owner: OwnerIdentity,
  address: string,
  context?: { neighborhood?: string; existingEvidence?: string },
): Promise<EnrichmentContact | null> {
  const street = address.replace(/,?\s*San Francisco.*$/i, "").trim();
  const locationHint = context?.neighborhood?.trim()
    ? `${context.neighborhood}, San Francisco, CA`
    : "San Francisco, CA";

  const placeholder = isPlaceholderOwner(owner);

  const queries = placeholder
    ? uniqueStrings([
        `"${street}" ${locationHint} homeowner phone email`,
        `"${street}" San Francisco resident contact number`,
        `"${street}" ${locationHint} whitepages OR truepeoplesearch`,
      ])
    : uniqueStrings([
        `"${owner.fullName}" "${street}" ${locationHint} phone email`,
        `"${owner.firstName} ${owner.lastName}" "${street}" contact number`,
        `"${owner.fullName}" ${locationHint} whitepages OR truepeoplesearch`,
        `"${street}" ${owner.lastName} San Francisco phone`,
      ]);

  let combinedText = context?.existingEvidence ?? "";

  for (const query of queries) {
    try {
      const targeted = await exaSearch(exaApiKey, query, {
        numResults: 6,
        type: "auto",
        includeDomains: PEOPLE_DOMAINS,
        highlightQuery: "phone email mobile cell contact",
      });
      combinedText += `\n${formatExaResults(targeted)}`;
    } catch {
      // try next query
    }

    try {
      const broad = await exaSearch(exaApiKey, query, {
        numResults: 4,
        type: "auto",
        highlightQuery: "phone email",
      });
      combinedText += `\n${formatExaResults(broad)}`;
    } catch {
      // try next query
    }
  }

  const regexHits = extractContactsFromText(combinedText);
  let emails = regexHits.emails;
  let phones = regexHits.phones;

  if (emails.length === 0 && phones.length === 0) {
    const gptHits = await gptExtractContacts(
      placeholder ? { ...owner, fullName: owner.fullName || "Resident" } : owner,
      address,
      combinedText,
    );
    emails = gptHits.emails;
    phones = gptHits.phones;
  }

  const contactOwner = placeholder
    ? { ...owner, fullName: owner.fullName || "Property resident" }
    : owner;

  return buildContact(contactOwner, emails, phones, owner.linkedinUrl);
}

export async function resolveHomeownerContacts(options: {
  orangeSliceApiKey?: string;
  exaApiKey?: string;
  owner: OwnerIdentity;
  address: string;
  householdId?: string;
  context?: {
    neighborhood?: string;
    parcelNumber?: string;
    yearBuilt?: number;
    existingEvidence?: string;
  };
  contactWaterfall: (
    apiKey: string,
    owner: OwnerIdentity,
    address: string,
    householdId?: string,
    context?: {
      neighborhood?: string;
      parcelNumber?: string;
      yearBuilt?: number;
    },
  ) => Promise<EnrichmentContact | null>;
}): Promise<EnrichmentContact | null> {
  const { owner, address, householdId, context, contactWaterfall } = options;
  const attempts: Array<EnrichmentContact | null> = [];

  if (options.exaApiKey) {
    attempts.push(
      await findContactsViaPeopleSearch(options.exaApiKey, owner, address, {
        neighborhood: context?.neighborhood,
        existingEvidence: context?.existingEvidence,
      }),
    );
  }

  if (options.orangeSliceApiKey) {
    try {
      attempts.push(
        await contactWaterfall(
          options.orangeSliceApiKey,
          owner,
          address,
          householdId,
          context,
        ),
      );
    } catch {
      // Orange Slice key revoked or waterfall failed — Exa result still usable.
    }
  }

  const merged = mergeContacts(owner, attempts);
  if (merged) return merged;

  if (owner.linkedinUrl) {
    return buildContact(owner, [], [], owner.linkedinUrl);
  }

  return null;
}
