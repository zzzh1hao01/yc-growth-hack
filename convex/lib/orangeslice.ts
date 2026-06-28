import {
  resolveOwnerWithAssessor,
  type OwnerIdentity,
} from "./ownerResolution";
import { orangeslicePost } from "./orangesliceClient";
import {
  buildChannels,
  contactConfidence,
  legacyContactFields,
  type EnrichmentContact,
} from "./enrichmentTypes";

export type { OwnerIdentity } from "./ownerResolution";
export { resolveOwnerFromAddress, resolveOwnerWithAssessor } from "./ownerResolution";

/** @deprecated Use EnrichmentContact */
export type ContactInfo = {
  phone: string;
  email: string;
  name: string;
};

type PersonContactResult = {
  work_emails?: string[];
  work_phones?: string[];
  personal_emails?: string[];
  personal_phones?: string[];
  unknown_phones?: string[];
};

function uniqueStrings(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())))];
}

function buildEnrichmentContact(
  result: PersonContactResult,
  ownerName: string,
  linkedinUrl?: string,
): EnrichmentContact | null {
  const emails = uniqueStrings([
    ...(result.personal_emails ?? []),
    ...(result.work_emails ?? []),
  ]);
  const phones = uniqueStrings([
    ...(result.personal_phones ?? []),
    ...(result.work_phones ?? []),
    ...(result.unknown_phones ?? []),
  ]);
  if (emails.length === 0 && phones.length === 0 && !linkedinUrl) return null;

  return {
    emails,
    phones,
    linkedinUrl,
    confidence: contactConfidence({ emails, phones, linkedinUrl }),
    channels: buildChannels({ emails, phones, linkedinUrl }),
    ...legacyContactFields(ownerName, emails, phones),
  };
}

export async function findLinkedInUrl(
  apiKey: string,
  owner: OwnerIdentity,
  address: string,
): Promise<string | undefined> {
  try {
    const url = await orangeslicePost<string | null>(
      apiKey,
      "/execute/linkedin-find-profile-url",
      {
        name: owner.fullName,
        location: "San Francisco, CA",
        keyword: address,
        company: address,
      },
    );
    if (typeof url === "string" && url.includes("linkedin.com/in/")) {
      return url;
    }
  } catch {
    // optional
  }
  return undefined;
}

async function contactWaterfall(
  apiKey: string,
  owner: OwnerIdentity,
  address: string,
  householdId?: string,
): Promise<EnrichmentContact | null> {
  const parcelHint = householdId?.replace("-", " ") ?? "";
  const attempts: Array<Record<string, unknown>> = [];

  if (owner.linkedinUrl) {
    for (const required of [["email", "phone"], ["email"], ["phone"]]) {
      attempts.push({
        linkedinUrl: owner.linkedinUrl,
        required,
        maxCoverage: true,
      });
    }
  }

  attempts.push(
    {
      firstName: owner.firstName,
      lastName: owner.lastName,
      location: "San Francisco, CA",
      company: address,
      required: ["email", "phone"],
      maxCoverage: true,
    },
    {
      firstName: owner.firstName,
      lastName: owner.lastName,
      location: "San Francisco, CA",
      company: "San Francisco Homeowner",
      required: ["email", "phone"],
      maxCoverage: true,
    },
  );

  if (parcelHint) {
    attempts.push({
      firstName: owner.firstName,
      lastName: owner.lastName,
      location: "San Francisco, CA",
      company: parcelHint,
      required: ["email", "phone"],
      maxCoverage: true,
    });
  }

  attempts.push(
    {
      firstName: owner.firstName,
      lastName: owner.lastName,
      location: "San Francisco, CA",
      required: ["email"],
      maxCoverage: true,
    },
    {
      firstName: owner.firstName,
      lastName: owner.lastName,
      location: "San Francisco, CA",
      required: ["phone"],
      maxCoverage: true,
    },
  );

  let best: EnrichmentContact | null = null;
  for (const payload of attempts) {
    try {
      const contact = await orangeslicePost<PersonContactResult>(
        apiKey,
        "/execute/contact-waterfall",
        payload,
      );
      const picked = buildEnrichmentContact(contact, owner.fullName, owner.linkedinUrl);
      if (!picked) continue;
      if (picked.confidence === "high") return picked;
      if (
        !best ||
        picked.emails.length + picked.phones.length > best.emails.length + best.phones.length
      ) {
        best = picked;
      }
    } catch {
      // try next
    }
  }
  return best;
}

export async function enrichHomeownerContact(
  apiKey: string,
  address: string,
  existingOwner?: Partial<OwnerIdentity>,
  householdId?: string,
  exaApiKey?: string,
  recordedOwner?: { fullName?: string; source?: string },
  ownerOccupied = true,
): Promise<{ contact: EnrichmentContact; owner: OwnerIdentity }> {
  let owner: OwnerIdentity;

  if (existingOwner?.firstName && existingOwner?.lastName) {
    owner = {
      firstName: existingOwner.firstName,
      lastName: existingOwner.lastName,
      fullName:
        existingOwner.fullName ??
        `${existingOwner.firstName} ${existingOwner.lastName}`,
      linkedinUrl: existingOwner.linkedinUrl,
      source: existingOwner.source ?? "cached",
      contactRole: existingOwner.contactRole,
      confidence: existingOwner.confidence,
      assessorParcel: existingOwner.assessorParcel,
    };
  } else {
    const resolved = await resolveOwnerWithAssessor({
      address,
      householdId,
      ownerOccupied,
      exaApiKey,
      orangeSliceApiKey: apiKey,
      recordedOwnerFullName: recordedOwner?.fullName,
      recordedOwnerSource: recordedOwner?.source,
    });
    owner = resolved.owner;
  }

  if (!owner.linkedinUrl) {
    const linkedinUrl = await findLinkedInUrl(apiKey, owner, address);
    if (linkedinUrl) {
      owner = { ...owner, linkedinUrl, source: `${owner.source}+linkedin` };
    }
  }

  const contact = await contactWaterfall(apiKey, owner, address, householdId);
  if (!contact) {
    return {
      contact: {
        emails: [],
        phones: [],
        linkedinUrl: owner.linkedinUrl,
        confidence: owner.linkedinUrl ? "medium" : "low",
        channels: buildChannels({
          emails: [],
          phones: [],
          linkedinUrl: owner.linkedinUrl,
        }),
        ...legacyContactFields(owner.fullName, [], []),
      },
      owner,
    };
  }

  if (owner.linkedinUrl && !contact.linkedinUrl) {
    contact.linkedinUrl = owner.linkedinUrl;
    contact.channels = buildChannels(contact);
    contact.confidence = contactConfidence(contact);
  }

  return { contact, owner };
}
