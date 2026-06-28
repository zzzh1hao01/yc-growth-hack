import { lookupBusinessContext as googlePlacesLookup } from "./google";

export type BusinessContextInput = {
  businessDescription: string;
  businessAddress: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  businessName?: string;
};

type FiberLookup = {
  api: string;
  credits?: number;
  summary: string;
};

type CompanyPerson = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
};

export type CompanyContext = {
  name: string;
  headline?: string;
  about?: string;
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  stats?: {
    rating?: number;
    reviewCount?: number;
    employeeCount?: number;
    founded?: string;
    industry?: string;
    primaryType?: string;
  };
  contacts?: {
    phones: string[];
    emails: string[];
  };
  people?: CompanyPerson[];
  socialLinks?: { platform: string; url: string }[];
  linkedinUrl?: string;
  sources: string[];
  fiberLookups: FiberLookup[];
};

type FiberCompany = Record<string, unknown> & {
  preferred_name?: string;
  name?: string;
  domains?: string[];
  phone_numbers?: string[];
  emails?: string[];
  li_description?: string;
  linkedin_primary_slug?: string;
  employee_count_consensus?: { gte?: number; lte?: number };
  founded_on_consensus?: string;
  primary_industry?: string;
  industries?: string[];
};

type LocalBusinessObservation = {
  websiteUrls?: string[];
  rationale?: unknown;
  localBusiness?: {
    companyName?: string;
    domain?: string | null;
    address?: string | null;
  };
  businessEmails?: Array<{ emailAddress: string }>;
  businessPhones?: Array<{ phoneNumber: string }>;
  socialMediaLinks?: Array<{ url: string; platform: string }>;
  employees?: Array<{
    name: string;
    role?: string | null;
    emailAddress?: { emailAddress: string } | null;
    phoneNumber?: { phoneNumber: string } | null;
  }>;
};

function fiberApiKey(): string | null {
  return process.env.FIBER_AI_API_KEY ?? null;
}

function extractDomain(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])];
}

function chargeCredits(chargeInfo?: Record<string, unknown>): number | undefined {
  const credits = chargeInfo?.creditsCharged;
  return typeof credits === "number" ? credits : undefined;
}

async function fiberPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ output?: T; chargeInfo?: Record<string, unknown> } | null> {
  const apiKey = fiberApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(`https://api.fiber.ai${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, ...body }),
    });

    if (!response.ok) return null;
    return (await response.json()) as { output?: T; chargeInfo?: Record<string, unknown> };
  } catch {
    return null;
  }
}

async function kitchenSinkCompanyLookup(params: {
  name?: string;
  domain?: string;
}): Promise<{ company: FiberCompany | null; lookup: FiberLookup | null }> {
  if (!params.name && !params.domain) {
    return { company: null, lookup: null };
  }

  const body: Record<string, unknown> = {};
  if (params.name) body.companyName = { value: params.name };
  if (params.domain) body.companyDomain = { value: params.domain };

  const response = await fiberPost<{ data?: FiberCompany[]; message?: string }>(
    "/v1/kitchen-sink/company",
    body,
  );

  const company = response?.output?.data?.[0] ?? null;
  const credits = chargeCredits(response?.chargeInfo);

  if (company) {
    return {
      company,
      lookup: {
        api: "kitchen-sink/company",
        credits,
        summary: "LinkedIn company profile, size, industry, and contact channels",
      },
    };
  }

  return {
    company: null,
    lookup: {
      api: "kitchen-sink/company",
      credits,
      summary:
        response?.output?.message ??
        "No matching company record in Fiber's B2B database",
    },
  };
}

async function pollLocalBusinessSearch(input: {
  companyName: string;
  formattedAddress: string;
  businessDescription: string;
}): Promise<{ observation: LocalBusinessObservation | null; lookup: FiberLookup }> {
  const started = await fiberPost<{ researchRunId?: string }>(
    "/v1/local-business-search/start",
    {
      companies: [
        {
          companyName: input.companyName,
          companyAddress: input.formattedAddress,
          companyCity: "San Francisco",
          companyState: "California",
          companyCountryCode: "US",
          context: input.businessDescription.slice(0, 500),
        },
      ],
      jobTitles: ["Owner", "President", "General Manager", "Founder", "Managing Director"],
      contactPreferences: {
        companyEmails: true,
        companyPhones: true,
        personEmails: true,
        personPhones: true,
      },
    },
  );

  const researchRunId = started?.output?.researchRunId;
  const startCredits = chargeCredits(started?.chargeInfo);

  if (!researchRunId) {
    return {
      observation: null,
      lookup: {
        api: "local-business-search",
        credits: startCredits,
        summary: "Could not start local business contact research",
      },
    };
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const polled = await fiberPost<{
      status?: string;
      data?: { observations?: LocalBusinessObservation[] };
    }>("/v1/local-business-search/poll", { researchRunId });

    const status = polled?.output?.status;
    const observations = polled?.output?.data?.observations ?? [];
    const pollCredits = chargeCredits(polled?.chargeInfo);
    const credits = pollCredits ?? startCredits;

    if (observations.length > 0) {
      return {
        observation: observations[0],
        lookup: {
          api: "local-business-search",
          credits,
          summary:
            status === "COMPLETED"
              ? "Local business contacts, phones, emails, and key people"
              : "Partial local business contacts while research was still running",
        },
      };
    }

    if (status === "COMPLETED" || status === "FAILED") {
      return {
        observation: null,
        lookup: {
          api: "local-business-search",
          credits,
          summary:
            status === "FAILED"
              ? "Local business agent could not resolve additional contacts"
              : "Local business research completed without contact matches",
        },
      };
    }
  }

  return {
    observation: null,
    lookup: {
      api: "local-business-search",
      credits: startCredits,
      summary: "Timed out waiting for local business contact research",
    },
  };
}

function mergeCompanyContext(parts: {
  seedName?: string;
  places?: Record<string, unknown> | null;
  kitchenSink?: FiberCompany | null;
  localBusiness?: LocalBusinessObservation | null;
  fiberLookups: FiberLookup[];
}): CompanyContext {
  const places = parts.places ?? {};
  const kitchen = parts.kitchenSink;
  const local = parts.localBusiness;

  const name =
    asText(kitchen?.preferred_name) ??
    asText(kitchen?.name) ??
    asText(local?.localBusiness?.companyName) ??
    asText(places.name) ??
    parts.seedName ??
    "Your business";

  const domain =
    kitchen?.domains?.[0] ??
    local?.localBusiness?.domain ??
    extractDomain(asText(places.website));

  const phones = uniqueStrings([
    asText(places.phone),
    kitchen?.phone_numbers?.[0],
    ...(local?.businessPhones?.map((p) => p.phoneNumber) ?? []),
    ...(local?.employees?.map((e) => e.phoneNumber?.phoneNumber) ?? []),
  ]);

  const emails = uniqueStrings([
    asText(places.email),
    kitchen?.emails?.[0],
    ...(local?.businessEmails?.map((e) => e.emailAddress) ?? []),
    ...(local?.employees?.map((e) => e.emailAddress?.emailAddress) ?? []),
  ]);

  const people: CompanyPerson[] = [];
  for (const employee of local?.employees ?? []) {
    if (!employee.name) continue;
    people.push({
      name: employee.name,
      role: employee.role ?? undefined,
      email: employee.emailAddress?.emailAddress,
      phone: employee.phoneNumber?.phoneNumber,
    });
  }

  const socialLinks = (local?.socialMediaLinks ?? []).map((link) => ({
    platform: link.platform,
    url: link.url,
  }));

  const employeeCount = kitchen?.employee_count_consensus?.gte;
  const founded = kitchen?.founded_on_consensus?.slice(0, 4);
  const rating = typeof places.rating === "number" ? places.rating : undefined;
  const reviewCount =
    typeof places.numReviews === "number" ? places.numReviews : undefined;
  const industry =
    asText(kitchen?.primary_industry) ?? asText(places.primaryType);

  const headlineParts = [
    industry,
    employeeCount ? `${employeeCount} employees` : undefined,
    founded ? `Founded ${founded}` : undefined,
    rating ? `${rating.toFixed(1)}★${reviewCount ? ` (${reviewCount} reviews)` : ""}` : undefined,
  ].filter(Boolean);

  const about =
    asText(kitchen?.li_description)?.slice(0, 500) ??
    asText(local?.rationale) ??
    asText(places.description) ??
    undefined;

  const sources = uniqueStrings([
    places.source ? String(places.source) : undefined,
    kitchen ? "fiber:kitchen-sink" : undefined,
    local ? "fiber:local-business" : undefined,
  ]);

  return {
    name,
    headline: headlineParts.join(" · ") || undefined,
    about,
    address:
      asText(places.address) ??
      asText(local?.localBusiness?.address) ??
      undefined,
    website:
      (domain ? `https://${domain}` : undefined) ??
      asText(places.website) ??
      local?.websiteUrls?.[0],
    phone: phones[0],
    email: emails[0],
    stats: {
      rating,
      reviewCount,
      employeeCount,
      founded,
      industry,
      primaryType: asText(places.primaryType),
    },
    contacts: {
      phones,
      emails,
    },
    people: people.length > 0 ? people : undefined,
    socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
    linkedinUrl: kitchen?.linkedin_primary_slug
      ? `https://www.linkedin.com/company/${kitchen.linkedin_primary_slug}`
      : undefined,
    sources,
    fiberLookups: parts.fiberLookups,
  };
}

export async function searchBusinessContext(
  input: BusinessContextInput,
): Promise<CompanyContext | null> {
  const fiberLookups: FiberLookup[] = [];

  const places =
    (await googlePlacesLookup(
      input.businessAddress,
      input.formattedAddress,
      input.lat,
      input.lng,
    )) ?? null;

  if (places) {
    const placeName = asText(places.name);
    fiberLookups.push({
      api: "google-places",
      credits: 0,
      summary: placeName
        ? `Matched "${placeName}" at your address (rating, phone, category)`
        : "Matched a listing at your address (rating, phone, category)",
    });
  } else {
    fiberLookups.push({
      api: "google-places",
      credits: 0,
      summary: "No Google listing found at this exact address",
    });
  }

  const seedName =
    input.businessName ||
    asText(places?.name) ||
    input.businessDescription.split(/[.!?\n]/)[0]?.trim();

  const companyName = asText(places?.name) ?? seedName ?? "Your business";
  const companyDomain =
    extractDomain(asText(places?.website)) ??
    extractDomain(input.businessDescription.match(/https?:\/\/[^\s,)]+/i)?.[0]);

  if (fiberApiKey()) {
    const { company, lookup } = await kitchenSinkCompanyLookup({
      name: companyName,
      domain: companyDomain,
    });
    if (lookup) fiberLookups.push(lookup);

    const { observation, lookup: localLookup } = await pollLocalBusinessSearch({
      companyName,
      formattedAddress: input.formattedAddress,
      businessDescription: input.businessDescription,
    });
    fiberLookups.push(localLookup);

    return mergeCompanyContext({
      seedName,
      places,
      kitchenSink: company,
      localBusiness: observation,
      fiberLookups,
    });
  }

  if (!places) return null;

  return mergeCompanyContext({
    seedName,
    places,
    fiberLookups,
  });
}
