"use client";

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
  const ctx = asCompanyContext(companyContext);
  const displayName = businessName?.trim() || asDisplayText(ctx?.name) || "Your agency";

  return (
    <aside className="absolute bottom-4 left-4 z-20 w-full max-w-sm rounded-xl border border-amber-300/60 bg-[#fff9f0]/95 p-4 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/70">
        Your agency
      </p>
      <p className="mt-1 text-sm font-semibold text-amber-950">{displayName}</p>
      {serviceTypes && serviceTypes.length > 0 && (
        <p className="mt-1 text-xs text-amber-900/75">
          Targeting: {serviceTypes.join(", ")}
        </p>
      )}

      {enrichmentStatus === "pending" && (
        <p className="mt-2 animate-pulse text-[11px] text-amber-900/70">
          Loading business details…
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
    </aside>
  );
}
