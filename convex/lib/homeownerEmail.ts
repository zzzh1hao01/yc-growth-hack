"use node";

import { resolveMx } from "dns/promises";
import {
  buildChannels,
  contactConfidence,
  isPlaceholderOwner,
  legacyContactFields,
  type EnrichmentContact,
} from "./enrichmentTypes";
import type { OwnerIdentity } from "./ownerResolution";

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "comcast.net",
  "sbcglobal.net",
  "att.net",
  "msn.com",
  "verizon.net",
  "earthlink.net",
  "cox.net",
  "bellsouth.net",
]);

const BLOCKED_EMAIL_DOMAINS = new Set([
  "example.com",
  "email.com",
  "domain.com",
  "test.com",
  "sentry.io",
  "whitepages.com",
  "truepeoplesearch.com",
  "fastpeoplesearch.com",
  "spokeo.com",
  "beenverified.com",
  "radaris.com",
  "411.com",
  "anywho.com",
  "usphonebook.com",
  "linkedin.com",
  "facebook.com",
  "google.com",
  "mapbox.com",
  "wikipedia.org",
  "orangeslice.ai",
  "enrichly-production.up.railway.app",
  "localhost",
]);

const BLOCKED_LOCAL_PREFIXES = [
  "support",
  "info",
  "help",
  "admin",
  "contact",
  "sales",
  "noreply",
  "no-reply",
  "privacy",
  "legal",
  "webmaster",
  "postmaster",
  "abuse",
  "mailer-daemon",
  "donotreply",
  "hello",
  "team",
  "office",
  "service",
  "customerservice",
];

const EMAIL_FORMAT =
  /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export type HomeownerEmailScore = {
  email: string;
  score: number;
  reasons: string[];
};

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emailLocalPart(email: string): string {
  return email.split("@")[0]?.toLowerCase() ?? "";
}

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function matchesOwnerName(email: string, owner: OwnerIdentity): boolean {
  const local = normalizeToken(emailLocalPart(email));
  const first = normalizeToken(owner.firstName);
  const last = normalizeToken(owner.lastName);

  if (!first || !last || first.length < 2 || last.length < 2) return false;

  const variants = new Set([
    first,
    last,
    `${first}${last}`,
    `${first}.${last}`,
    `${first}_${last}`,
    `${first[0]}${last}`,
    `${first}${last[0]}`,
    `${last}${first}`,
    `${last}.${first}`,
    `${last}${first[0]}`,
  ]);

  for (const variant of variants) {
    if (variant.length >= 3 && local.includes(variant)) return true;
  }

  return false;
}

export function scoreHomeownerEmail(
  email: string,
  owner: OwnerIdentity,
): HomeownerEmailScore | null {
  const trimmed = email.trim().toLowerCase();
  const reasons: string[] = [];

  if (!EMAIL_FORMAT.test(trimmed)) return null;

  const [local, domain] = trimmed.split("@");
  if (!local || !domain) return null;

  if (BLOCKED_EMAIL_DOMAINS.has(domain)) return null;
  if (/\.(png|jpe?g|gif|svg|webp|js|css)$/i.test(domain)) return null;
  if (local.length < 3) return null;
  if (/^\d+$/.test(local)) return null;

  for (const prefix of BLOCKED_LOCAL_PREFIXES) {
    if (local === prefix || local.startsWith(`${prefix}.`) || local.startsWith(`${prefix}+`)) {
      return null;
    }
  }

  if (isPlaceholderOwner(owner)) {
    return null;
  }

  let score = 0;
  const personalDomain = PERSONAL_EMAIL_DOMAINS.has(domain);

  if (personalDomain) {
    score += 20;
    reasons.push("personal_domain");
  } else if (domain.endsWith(".edu") || domain.endsWith(".gov")) {
    score += 5;
    reasons.push("institutional_domain");
  } else {
    score += 2;
    reasons.push("other_domain");
  }

  if (matchesOwnerName(trimmed, owner)) {
    score += 30;
    reasons.push("name_match");
  } else if (!personalDomain) {
    return null;
  } else {
    score -= 10;
    reasons.push("weak_name_match");
  }

  if (score < 15) return null;

  return { email: trimmed, score, reasons };
}

export async function hasDeliverableMx(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

export async function filterHomeownerEmails(
  emails: string[],
  owner: OwnerIdentity,
  options?: { max?: number; verifyMx?: boolean },
): Promise<string[]> {
  const max = options?.max ?? 2;
  const verifyMx = options?.verifyMx ?? true;

  const scored = emails
    .map((email) => scoreHomeownerEmail(email, owner))
    .filter((entry): entry is HomeownerEmailScore => entry != null)
    .sort((a, b) => b.score - a.score);

  const verified: string[] = [];

  for (const entry of scored) {
    if (verified.length >= max) break;

    if (verifyMx) {
      const domain = emailDomain(entry.email);
      const mxOk = await hasDeliverableMx(domain);
      if (!mxOk) continue;
    }

    verified.push(entry.email);
  }

  return verified;
}

export async function sanitizeContactEmails(
  emails: string[],
  owner: OwnerIdentity,
): Promise<string[]> {
  return filterHomeownerEmails(emails, owner, { max: 2, verifyMx: true });
}

export async function sanitizeEnrichmentContact(
  contact: EnrichmentContact,
  owner: OwnerIdentity,
): Promise<EnrichmentContact> {
  const emails = await sanitizeContactEmails(contact.emails, owner);
  const next = {
    emails,
    phones: contact.phones,
    linkedinUrl: contact.linkedinUrl,
  };
  return {
    ...contact,
    ...next,
    confidence: contactConfidence(next),
    channels: buildChannels(next),
    ...legacyContactFields(contact.name || owner.fullName, emails, contact.phones),
  };
}
