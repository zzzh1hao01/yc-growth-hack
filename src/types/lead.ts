/**
 * Canonical lead shape for the insurance bounty board UI.
 * Mapped from insurance ETL records + need/timing ranking in Convex.
 */

export type SpriteVariant = 0 | 1 | 2 | 3;

export type TimingConfidence = "high" | "low" | "none";

export type LeadDataSource = "placeholder" | "etl";

export type Lead = {
  id: string;
  convexId?: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  matchScore: number;
  compositeScore?: number;
  needScore?: number;
  timingScore?: number;
  timingConfidence?: TimingConfidence;
  urgent: boolean;
  worthOutreach?: boolean;
  spriteVariant: SpriteVariant;
  homeAgeYears: number;
  ownerOccupied?: boolean;
  replacementCostToday?: number;
  coverageAnchor?: number;
  replacementCostGapDollars?: number;
  replacementCostGapPct?: number;
  sqft?: number;
  purchaseYear?: number;
  yearsOwned?: number;
  yearBuilt?: number;
  cluster: string;
  clusterNarrative?: string;
  scoreReasons?: string[];
  /** Display-only when agent office is set — not used for ranking. */
  distanceMiles?: number;
  dataSource?: LeadDataSource;
  ownerFullName?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerContactRole?: "owner" | "resident" | "unknown";
  recordedOwnerFullName?: string;
  parcelNumber?: string;
  assessorBlock?: string;
  assessorLot?: string;
  archetype?: string;
  acsReceptivityScore?: number;
  financialSophistication?: number;
  inertiaScore?: number;
  coverageStakes?: number;
};

export type Persona = {
  summary?: string;
  likely_response_to_cold_approach?: string;
  common_objections?: string[];
  preferred_contact_channel?: string;
  /** @deprecated Contractor-era field */
  preferred_contractor_channel?: string;
  conversion_hooks?: string;
};

export type ContactInfo = {
  phone: string;
  email: string;
  name: string;
};

export type OutreachChannel = "email" | "phone" | "linkedin" | "mail" | "d2d";

export type EnrichmentContact = ContactInfo & {
  emails: string[];
  phones: string[];
  linkedinUrl?: string;
  confidence: "high" | "medium" | "low";
  channels: OutreachChannel[];
};

export type EnrichmentResult = {
  owner: {
    firstName: string;
    lastName: string;
    fullName: string;
    linkedinUrl?: string;
    source: string;
    contactRole?: "owner" | "resident" | "unknown";
  };
  contact: EnrichmentContact;
  playbook: string;
  assessorParcel?: { block: string; lot: string; parcelNumber: string };
};

export type OutreachStatus =
  | "queued"
  | "sheet_synced"
  | "touch1_ready"
  | "touch1_sent"
  | "touch2_sent"
  | "replied"
  | "meeting"
  | "won"
  | "lost"
  | "d2d_planned";

export type OutreachRecord = {
  status: OutreachStatus;
  primaryChannel?: OutreachChannel;
  campaignSlug?: string;
  sheetRowId?: string;
  lastActivityAt: number;
  activityLog: Array<{ at: number; event: string; detail?: string }>;
};

export type StartOutreachResult = {
  status: OutreachStatus;
  primaryChannel: OutreachChannel;
  campaignSlug: string;
  sheetSynced: boolean;
  sheetRowId?: string;
  sheetError?: string;
  sheetUrl: string | null;
  touch1: { subject: string; body: string; mailto?: string };
  touch2: { subject: string; body: string };
  enrichment: EnrichmentResult;
};

/** Insurance agent profile from onboarding GPT extraction. */
export type AgentProfile = {
  lines_of_business: string[];
  price_point: string;
  customer_preferences: string;
};

/** @deprecated Alias — Convex stores as serviceProfile. */
export type ServiceProfile = {
  service_types: string[];
  price_point: string;
  customer_preferences: string;
};

export type CompanyPerson = {
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
  sources?: string[];
  fiberLookups?: Array<{
    api: string;
    credits?: number;
    summary: string;
  }>;
};

/** UI type for session agent (stored in Convex `contractors` table). */
export type Agent = {
  name: string;
  businessDescription: string;
  businessAddress: string;
  lat?: number;
  lng?: number;
  serviceProfile?: AgentProfile;
  companyContext?: CompanyContext;
  companyEnrichmentStatus?: "pending" | "done" | "failed";
  businessName?: string;
  serviceRegionLabel?: string;
  serviceRegionIds?: string[];
  targetNeighborhoods?: string[];
};

/** @deprecated Use Agent — kept for gradual migration. */
export type Contractor = Agent;

export const INSURANCE_NEIGHBORHOODS = [
  "Portola",
  "Outer Richmond",
  "West of Twin Peaks",
  "Sunset/Parkside",
  "Inner Sunset",
] as const;

/** Pursue lead → Orange Slice outbound pipeline. */
export const OUTREACH_ENABLED = true;

export const OUTREACH_STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  sheet_synced: "In Orange Slice",
  touch1_ready: "Ready (no email)",
  touch1_sent: "Touch 1 sent",
  touch2_sent: "Touch 2 sent",
  replied: "Replied",
  meeting: "Meeting booked",
  won: "Won",
  lost: "Lost",
  d2d_planned: "Door knock planned",
};
