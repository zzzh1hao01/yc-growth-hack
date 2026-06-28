"use client";

import { useState } from "react";

import { asDisplayText } from "@/lib/safe-text";
import type { CompanyContext } from "@/types/lead";

type ContractorContextProps = {
  businessName?: string;
  businessAddress?: string;
  serviceTypes?: string[];
  companyContext?: CompanyContext | Record<string, unknown> | null;
  enrichmentStatus?: "pending" | "done" | "failed";
};

function asCompanyContext(
  value: CompanyContext | Record<string, unknown> | null | undefined,
): CompanyContext | null {
  if (!value || typeof value !== "object") return null;
  return value as CompanyContext;
}

export function ContractorContextPanel({
  businessName,
  businessAddress,
  serviceTypes,
  companyContext,
  enrichmentStatus,
}: ContractorContextProps) {
  const [expanded, setExpanded] = useState(true);
  const ctx = asCompanyContext(companyContext);
  const displayName = businessName?.trim() || asDisplayText(ctx?.name) || "Your business";
  const fiberLookups = ctx?.fiberLookups ?? [];

  if (!expanded) {
    return (
      <aside className="absolute bottom-4 left-4 z-20">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 rounded-full border border-amber-300/60 bg-[#fff9f0]/95 px-3 py-2 text-left shadow-lg backdrop-blur-sm transition hover:bg-white"
          aria-expanded={false}
          aria-label={`Show business details for ${displayName}`}
        >
          <span className="text-base leading-none" aria-hidden>
            🏢
          </span>
          <span className="max-w-[10rem] truncate text-xs font-semibold text-amber-950 sm:max-w-[14rem]">
            {displayName}
          </span>
          <span className="text-[10px] font-bold text-amber-800/70" aria-hidden>
            ▲
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="absolute bottom-4 left-4 z-20 w-full max-w-sm rounded-xl border border-amber-300/60 bg-[#fff9f0]/95 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/70">
            Your business
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-amber-950">{displayName}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 rounded-lg p-1.5 text-amber-900/60 transition hover:bg-amber-200/50"
          aria-expanded={true}
          aria-label="Hide business details to explore the map"
          title="Hide to explore map"
        >
          <span className="block text-xs font-bold leading-none">▼</span>
        </button>
      </div>

      {serviceTypes && serviceTypes.length > 0 && (
        <p className="mt-1 text-xs text-amber-900/75">
          Targeting: {serviceTypes.join(", ")}
        </p>
      )}

      {enrichmentStatus === "pending" && (
        <p className="mt-2 animate-pulse text-[11px] text-amber-900/70">
          Loading company details from Fiber…
        </p>
      )}

      {(ctx?.phone ||
        ctx?.email ||
        ctx?.website ||
        ctx?.address ||
        businessAddress ||
        ctx?.stats?.rating ||
        ctx?.headline) && (
        <ul className="mt-3 space-y-1 border-t border-amber-200/60 pt-3 text-xs text-amber-900/80">
          {(ctx?.address || businessAddress) && (
            <li>{ctx?.address ?? businessAddress}</li>
          )}
          {ctx?.headline && <li>{ctx.headline}</li>}
          {ctx?.stats?.rating != null && (
            <li>
              Google rating: {ctx.stats.rating.toFixed(1)}★
              {ctx.stats.reviewCount ? ` (${ctx.stats.reviewCount} reviews)` : ""}
            </li>
          )}
          {ctx?.phone && <li>Phone: {ctx.phone}</li>}
          {ctx?.email && <li>Email: {ctx.email}</li>}
          {ctx?.website && <li className="truncate">Website: {ctx.website}</li>}
          {(ctx?.people?.length ?? 0) > 0 && (
            <li>
              Contact: {ctx?.people?.[0]?.name}
              {ctx?.people?.[0]?.role ? ` · ${ctx.people[0].role}` : ""}
              {ctx?.people?.[0]?.phone ? ` · ${ctx.people[0].phone}` : ""}
            </li>
          )}
        </ul>
      )}

      {fiberLookups.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[10px] leading-relaxed text-amber-900/60">
          {fiberLookups.map((lookup, index) => (
            <li key={`${lookup.api}-${index}`}>
              {lookup.api}
              {lookup.credits != null ? ` (${lookup.credits} cr)` : ""}: {lookup.summary}
            </li>
          ))}
        </ul>
      )}

      {enrichmentStatus === "done" && !ctx?.phone && !ctx?.email && !ctx?.stats?.rating && (
        <p className="mt-2 text-[11px] text-amber-900/65">
          Fiber ran successfully — this business has limited public data in their database.
        </p>
      )}
    </aside>
  );
}
