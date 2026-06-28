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
  const [expanded, setExpanded] = useState(false);
  const ctx = asCompanyContext(companyContext);
  const displayName = businessName?.trim() || asDisplayText(ctx?.name) || "Your agency";

  const hasDetails =
    enrichmentStatus === "pending" ||
    Boolean(
      ctx?.phone ||
        ctx?.email ||
        ctx?.website ||
        ctx?.address ||
        businessAddress ||
        ctx?.stats?.rating ||
        ctx?.headline ||
        (ctx?.people?.length ?? 0) > 0,
    );

  return (
    <aside className="western-panel game-panel-compact absolute bottom-4 left-4 z-20 w-full max-w-xs">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="western-label">Your agency</p>
          <p className="western-title mt-1 truncate text-sm normal-case">{displayName}</p>
          {!expanded && serviceTypes && serviceTypes.length > 0 && (
            <p className="western-body mt-0.5 truncate text-[11px]">{serviceTypes.join(", ")}</p>
          )}
        </div>
        {hasDetails && (
          <span className="western-label mt-0.5 shrink-0" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-[rgba(166,124,82,0.45)] px-3 pb-3 pt-2">
          {serviceTypes && serviceTypes.length > 0 && (
            <p className="western-body text-xs">Targeting: {serviceTypes.join(", ")}</p>
          )}

          {enrichmentStatus === "pending" && (
            <p className="western-body mt-2 animate-pulse text-[11px]">Loading business details…</p>
          )}

          {(ctx?.phone ||
            ctx?.email ||
            ctx?.website ||
            ctx?.address ||
            businessAddress ||
            ctx?.stats?.rating ||
            ctx?.headline) && (
            <ul className="western-body mt-2 space-y-1 text-xs">
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
        </div>
      )}
    </aside>
  );
}
