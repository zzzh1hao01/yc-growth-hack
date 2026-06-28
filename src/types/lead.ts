/**
 * Canonical lead shape for the bounty board UI.
 * Mapped from partner household records + proximity ranking in Convex.
 */

export type SpriteVariant = 0 | 1 | 2 | 3;

export type ScoreVertical = "hvac" | "panel" | "ev";

export type VerticalScoreEntry = {
  score: number;
  urgency_flag: boolean;
  last_relevant_permit_date?: string | null;
  reasons: string[];
};

export type LeadDataSource = "placeholder" | "etl";

export type Lead = {
  id: string;
  convexId?: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  matchScore: number;
  baseScore?: number;
  compositeScore?: number;
  urgent: boolean;
  spriteVariant: SpriteVariant;
  permitAgeYears: number;
  lastPermitType?: string;
  lastPermitDate?: string;
  hasOpenPermit?: boolean;
  homeAgeYears: number;
  ownerOccupied?: boolean;
  assessedValue?: number;
  lastSaleDate?: string;
  clusterId?: string;
  cluster: string;
  clusterNarrative?: string;
  vertical?: ScoreVertical;
  verticalScores?: Record<string, VerticalScoreEntry>;
  scoreReasons?: string[];
  distanceMiles?: number;
  yearBuilt?: number;
  dataSource?: LeadDataSource;
  ownerFullName?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerContactRole?: "owner" | "resident" | "unknown";
};

export type Persona = {
  summary?: string;
  likely_response_to_cold_approach?: string;
  common_objections?: string[];
  preferred_contractor_channel?: string;
  conversion_hooks?: string;
};

export type ContactInfo = {
  phone: string;
  email: string;
  name: string;
};

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

export type Contractor = {
  name: string;
  businessDescription: string;
  businessAddress: string;
  lat?: number;
  lng?: number;
  serviceProfile?: ServiceProfile;
  companyContext?: CompanyContext;
  serviceRegionLabel?: string;
  serviceRegionIds?: string[];
};
