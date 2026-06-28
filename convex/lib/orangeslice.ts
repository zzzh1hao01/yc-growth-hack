import {
  resolveOwnerFromAddress,
  type OwnerIdentity,
} from "./ownerResolution";
import { orangeslicePost } from "./orangesliceClient";

export type { OwnerIdentity } from "./ownerResolution";
export { resolveOwnerFromAddress } from "./ownerResolution";

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
        location: "San Francisco, California",
        keyword: address,
        company: "Homeowner",
      },
    );
    if (typeof url === "string" && url.includes("linkedin.com/in/")) {
      return url;
    }
  } catch {
    // optional step
  }
  return undefined;
}

function pickContact(
  result: PersonContactResult,
  ownerName: string,
): ContactInfo | null {
  const email =
    result.personal_emails?.[0] ??
    result.work_emails?.[0] ??
    undefined;
  const phone =
    result.personal_phones?.[0] ??
    result.work_phones?.[0] ??
    result.unknown_phones?.[0] ??
    undefined;

  if (!email && !phone) return null;

  return {
    name: ownerName,
    email: email ?? "Not found",
    phone: phone ?? "Not found",
  };
}

async function contactWaterfall(
  apiKey: string,
  owner: OwnerIdentity,
  address: string,
): Promise<ContactInfo | null> {
  const attempts: Array<Record<string, unknown>> = [];

  if (owner.linkedinUrl) {
    attempts.push({
      linkedinUrl: owner.linkedinUrl,
      required: ["email", "phone"],
      maxCoverage: true,
    });
  }

  attempts.push(
    {
      firstName: owner.firstName,
      lastName: owner.lastName,
      company: "San Francisco Homeowner",
      domain: undefined,
      required: ["email", "phone"],
      maxCoverage: true,
    },
    {
      firstName: owner.firstName,
      lastName: owner.lastName,
      company: address,
      required: ["email", "phone"],
      maxCoverage: true,
    },
    {
      firstName: owner.firstName,
      lastName: owner.lastName,
      required: ["email"],
      maxCoverage: true,
    },
    {
      firstName: owner.firstName,
      lastName: owner.lastName,
      required: ["phone"],
      maxCoverage: true,
    },
  );

  for (const payload of attempts) {
    try {
      const contact = await orangeslicePost<PersonContactResult>(
        apiKey,
        "/execute/contact-waterfall",
        payload,
      );
      const picked = pickContact(contact, owner.fullName);
      if (picked) return picked;
    } catch {
      // try next strategy
    }
  }

  return null;
}

export async function enrichHomeownerContact(
  apiKey: string,
  address: string,
  existingOwner?: Partial<OwnerIdentity>,
  householdId?: string,
  exaApiKey?: string,
): Promise<{ contact: ContactInfo; owner: OwnerIdentity }> {
  const owner =
    existingOwner?.firstName && existingOwner?.lastName
      ? {
          firstName: existingOwner.firstName,
          lastName: existingOwner.lastName,
          fullName:
            existingOwner.fullName ??
            `${existingOwner.firstName} ${existingOwner.lastName}`,
          linkedinUrl: existingOwner.linkedinUrl,
          source: existingOwner.source ?? "cached",
        }
      : await resolveOwnerFromAddress({
          address,
          householdId,
          exaApiKey,
          orangeSliceApiKey: apiKey,
        });

  const contact = await contactWaterfall(apiKey, owner, address);
  if (!contact) {
    throw new Error(
      `Found homeowner "${owner.fullName}" but no phone/email via Orange Slice. Name was resolved from ${owner.source}.`,
    );
  }

  return { contact, owner };
}
