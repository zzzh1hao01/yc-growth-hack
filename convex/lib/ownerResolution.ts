import { chatCompletion } from "./openai";
import { exaSearch, formatExaResults, type ExaSearchResult } from "./exa";
import { orangeslicePost } from "./orangesliceClient";
import {
  assessorEvidenceText,
  fetchAssessorParcelByHouseholdId,
  type AssessorParcel,
} from "./datasfAssessor";

export type ContactRole = "owner" | "resident" | "unknown";

export type OwnerIdentity = {
  firstName: string;
  lastName: string;
  fullName: string;
  linkedinUrl?: string;
  source: string;
  confidence?: "high" | "medium" | "low";
  contactRole?: ContactRole;
  assessorParcel?: {
    block: string;
    lot: string;
    parcelNumber: string;
  };
};

type ResolveOwnerOptions = {
  address: string;
  householdId?: string;
  ownerOccupied?: boolean;
  exaApiKey?: string;
  orangeSliceApiKey?: string;
  recordedOwnerFullName?: string;
  recordedOwnerSource?: string;
};

export type ResolveOwnerResult = {
  owner: OwnerIdentity;
  assessorParcel?: AssessorParcel;
  ownerOccupied: boolean;
};

type EvidenceChunk = {
  source: string;
  text: string;
};

const PROPERTY_DOMAINS = [
  "propertyshark.com",
  "blockshopper.com",
  "whitepages.com",
  "truepeoplesearch.com",
  "fastpeoplesearch.com",
  "realtor.com",
  "redfin.com",
  "zillow.com",
];

function normalizeAddress(address: string): string {
  return address.replace(/,?\s*San Francisco.*$/i, "").trim();
}

function parseFullName(fullName: string): { firstName: string; lastName: string } | null {
  const cleaned = fullName.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function extractSerpText(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data;

  const chunks: string[] = [];
  const visit = (node: unknown, depth = 0) => {
    if (depth > 6 || node == null) return;
    if (typeof node === "string") {
      if (node.length > 20) chunks.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      for (const key of ["title", "snippet", "description", "text", "content"]) {
        if (typeof obj[key] === "string") chunks.push(obj[key] as string);
      }
      for (const value of Object.values(obj)) visit(value, depth + 1);
    }
  };

  visit(data);
  return [...new Set(chunks)].slice(0, 30).join("\n");
}

async function orangeSliceWebSearch(
  apiKey: string,
  queries: string[],
): Promise<string> {
  try {
    const batch = await orangeslicePost<unknown>(apiKey, "/execute/serp-batch", {
      queries: queries.map((query) => ({ query })),
    });
    return extractSerpText(batch);
  } catch {
    const parts: string[] = [];
    for (const query of queries.slice(0, 3)) {
      try {
        const single = await orangeslicePost<unknown>(apiKey, "/execute/serp", {
          query,
        });
        parts.push(extractSerpText(single));
      } catch {
        // try next query
      }
    }
    return parts.join("\n");
  }
}

async function gatherExaEvidence(
  apiKey: string,
  address: string,
  householdId?: string,
  deep = false,
  ownerOccupied = true,
): Promise<string> {
  const street = normalizeAddress(address);
  const parcelHint = householdId?.replace("-", " ") ?? "";

  const queries = ownerOccupied
    ? [
        `Current homeowner or property owner at ${street}, San Francisco California`,
        `"${street}" San Francisco CA resident owner name property record`,
        `${street} San Francisco assessor parcel owner occupied`,
        parcelHint
          ? `San Francisco assessor block lot ${parcelHint} owner name`
          : `"${street}" San Francisco whitepages OR people search homeowner`,
      ]
    : [
        `Who lives at ${street}, San Francisco California current resident tenant`,
        `"${street}" San Francisco CA who lives resident address`,
        `"${street}" San Francisco property owner OR tenant name`,
        parcelHint
          ? `San Francisco parcel block ${parcelHint} owner or resident`
          : `"${street}" San Francisco whitepages OR spokeo resident`,
      ].filter(Boolean);

  const searchType = deep ? "deep" : "auto";
  const batches = await Promise.all(
    queries.slice(0, 4).map(async (query) => {
      try {
        return await exaSearch(apiKey, query, {
          type: searchType,
          numResults: deep ? 10 : 7,
          highlightQuery: `owner resident homeowner name for ${street}`,
        });
      } catch {
        return [] as ExaSearchResult[];
      }
    }),
  );

  let combined = formatExaResults(batches.flat());

  if (!deep) {
    try {
      const domainResults = await exaSearch(
        apiKey,
        `Property owner at ${street} San Francisco`,
        {
          type: "auto",
          numResults: 6,
          includeDomains: PROPERTY_DOMAINS,
          highlightQuery: `owner name ${street}`,
        },
      );
      combined = [combined, formatExaResults(domainResults)].filter(Boolean).join("\n\n");
    } catch {
      // optional domain-focused pass
    }
  }

  return combined;
}

async function extractOwnerFromEvidence(
  address: string,
  evidence: EvidenceChunk[],
  ownerOccupied = true,
): Promise<OwnerIdentity | null> {
  const combined = evidence
    .filter((chunk) => chunk.text.trim())
    .map((chunk) => `=== ${chunk.source} ===\n${chunk.text.slice(0, 5000)}`)
    .join("\n\n");

  if (!combined.trim()) return null;

  const raw = await chatCompletion(
    [
      {
        role: "system",
        content: `You identify the best contact person for a San Francisco property from web research — either the legal owner or whoever currently lives there.

Rules:
- Prefer individual person names (first + last). Use LLC/trust names only if no person appears.
- Ignore real estate agents, listing agents, contractors, and realtors.
- Require the evidence to plausibly refer to this specific address or parcel.
- If evidence is weak or contradictory, set confidence to "low" or "none".
- Return JSON only.`,
      },
      {
        role: "user",
        content: `Address: "${address}, San Francisco, CA"
Assessor owner-occupied flag: ${ownerOccupied ? "yes (likely owner lives here)" : "no (likely rental — prefer current resident/tenant over absentee owner)"}

Research:
${combined.slice(0, 14000)}

Return JSON:
{
  "firstName": "",
  "lastName": "",
  "fullName": "",
  "contactRole": "owner|resident|unknown",
  "confidence": "high|medium|low|none",
  "primarySource": "exa|web_search|mixed",
  "reasoning": "one short sentence"
}`,
      },
    ],
    { json: true },
  );

  let parsed: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    contactRole?: string;
    confidence?: string;
    primarySource?: string;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const confidence = parsed.confidence ?? "none";
  if (confidence === "none") return null;

  let firstName = parsed.firstName?.trim() ?? "";
  let lastName = parsed.lastName?.trim() ?? "";
  let fullName = parsed.fullName?.trim() ?? "";

  if (!fullName && firstName && lastName) {
    fullName = `${firstName} ${lastName}`;
  }

  const nameParts = fullName ? parseFullName(fullName) : null;
  if (!firstName && nameParts) firstName = nameParts.firstName;
  if (!lastName && nameParts) lastName = nameParts.lastName;

  if (!firstName || !lastName) return null;

  const parsedRole = parsed.contactRole?.trim().toLowerCase();
  const contactRole: ContactRole =
    parsedRole === "owner" || parsedRole === "resident"
      ? parsedRole
      : ownerOccupied
        ? "owner"
        : "resident";

  const sourcesUsed = evidence.map((e) => e.source);
  const sourceLabel =
    sourcesUsed.includes("exa") && sourcesUsed.includes("web_search")
      ? `exa+web (${parsed.primarySource ?? "mixed"})`
      : sourcesUsed.includes("exa")
        ? "exa"
        : "web_search";

  return {
    firstName,
    lastName,
    fullName: fullName || `${firstName} ${lastName}`,
    source: sourceLabel,
    confidence: confidence as OwnerIdentity["confidence"],
    contactRole,
  };
}

async function findLinkedInUrl(
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

export async function resolveOwnerFromAddress(
  options: ResolveOwnerOptions,
): Promise<OwnerIdentity> {
  const result = await resolveOwnerWithAssessor(options);
  return result.owner;
}

export async function resolveOwnerWithAssessor(
  options: ResolveOwnerOptions,
): Promise<ResolveOwnerResult> {
  const {
    address,
    householdId,
    ownerOccupied: ownerOccupiedInput = true,
    exaApiKey,
    orangeSliceApiKey,
    recordedOwnerFullName,
    recordedOwnerSource,
  } = options;

  let ownerOccupied = ownerOccupiedInput;
  let assessorParcel: AssessorParcel | undefined;

  if (recordedOwnerFullName?.trim()) {
    const nameParts = parseFullName(recordedOwnerFullName.trim());
    if (nameParts) {
      const owner: OwnerIdentity = {
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        fullName: recordedOwnerFullName.trim(),
        source: recordedOwnerSource ?? "ingest",
        confidence: "high",
        contactRole: ownerOccupied ? "owner" : "unknown",
      };
      if (householdId) {
        try {
          assessorParcel =
            (await fetchAssessorParcelByHouseholdId(householdId)) ?? undefined;
          if (assessorParcel?.homeownerExemption) ownerOccupied = true;
          if (assessorParcel) {
            owner.assessorParcel = {
              block: assessorParcel.block,
              lot: assessorParcel.lot,
              parcelNumber: assessorParcel.parcelNumber,
            };
          }
        } catch {
          // optional parcel enrichment
        }
      }
      if (orangeSliceApiKey) {
        const linkedinUrl = await findLinkedInUrl(orangeSliceApiKey, owner, address);
        if (linkedinUrl) {
          return {
            owner: { ...owner, linkedinUrl, source: `${owner.source}+linkedin` },
            assessorParcel,
            ownerOccupied,
          };
        }
      }
      return { owner, assessorParcel, ownerOccupied };
    }
  }

  if (householdId) {
    try {
      assessorParcel = (await fetchAssessorParcelByHouseholdId(householdId)) ?? undefined;
      if (assessorParcel?.homeownerExemption) ownerOccupied = true;
    } catch {
      // DataSF is best-effort; continue with web search
    }
  }

  const evidence: EvidenceChunk[] = [];
  if (assessorParcel) {
    evidence.push({ source: "datasf_assessor", text: assessorEvidenceText(assessorParcel) });
  }

  if (exaApiKey) {
    const exaText = await gatherExaEvidence(
      exaApiKey,
      address,
      householdId,
      false,
      ownerOccupied,
    );
    if (exaText.trim()) {
      evidence.push({ source: "exa", text: exaText });
    }
  }

  if (orangeSliceApiKey) {
    const street = normalizeAddress(address);
    const parcelHint = householdId?.replace("-", " ") ?? "";
    const queries = ownerOccupied
      ? [
          `"${street}" San Francisco CA homeowner name`,
          `"${street}" San Francisco property owner resident`,
          `"${street}" San Francisco whitepages OR truepeoplesearch`,
          parcelHint
            ? `San Francisco assessor block ${parcelHint} property owner`
            : `"${street}" San Francisco assessor parcel owner`,
        ]
      : [
          `"${street}" San Francisco CA who lives resident`,
          `"${street}" San Francisco current resident tenant address`,
          parcelHint
            ? `San Francisco parcel block ${parcelHint} resident`
            : `"who lives at ${street}" San Francisco`,
        ].filter(Boolean);

    const serpText = await orangeSliceWebSearch(orangeSliceApiKey, queries);
    if (serpText.trim()) {
      evidence.push({ source: "web_search", text: serpText });
    }
  }

  let owner = await extractOwnerFromEvidence(address, evidence, ownerOccupied);

  if (!owner && exaApiKey) {
    const deepText = await gatherExaEvidence(
      exaApiKey,
      address,
      householdId,
      true,
      ownerOccupied,
    );
    if (deepText.trim()) {
      owner = await extractOwnerFromEvidence(
        address,
        [...evidence, { source: "exa_deep", text: deepText }],
        ownerOccupied,
      );
      if (owner) {
        owner = {
          ...owner,
          source: owner.source.includes("exa") ? `${owner.source}+deep` : "exa+deep",
        };
      }
    }
  }

  if (!owner) {
    owner = {
      firstName: "Property",
      lastName: "Owner",
      fullName: "Property Owner",
      source: assessorParcel ? "datasf_parcel_only" : "unresolved",
      confidence: "low",
      contactRole: ownerOccupied ? "owner" : "resident",
    };
  }

  if (assessorParcel) {
    owner = {
      ...owner,
      assessorParcel: {
        block: assessorParcel.block,
        lot: assessorParcel.lot,
        parcelNumber: assessorParcel.parcelNumber,
      },
      source: owner.source.includes("datasf") ? owner.source : `${owner.source}+datasf`,
    };
  }

  if (orangeSliceApiKey) {
    const linkedinUrl = await findLinkedInUrl(orangeSliceApiKey, owner, address);
    if (linkedinUrl) {
      return {
        owner: { ...owner, linkedinUrl, source: `${owner.source}+linkedin` },
        assessorParcel,
        ownerOccupied,
      };
    }
  }

  return { owner, assessorParcel, ownerOccupied };
}
