"use client";

import { useCallback, useState } from "react";
import { useAction } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { asDisplayText } from "@/lib/safe-text";
import type { CompanyContext } from "@/types/lead";

type ContractorContextProps = {
  sessionId?: string;
  businessDescription: string;
  businessAddress?: string;
  serviceTypes?: string[];
  companyContext?: CompanyContext | Record<string, unknown> | null;
  enrichmentStatus?: "pending" | "done" | "failed";
  onContextRefresh?: (context: CompanyContext | undefined) => void;
  onEnrichmentStatusChange?: (status: "pending" | "done" | "failed") => void;
};

function asCompanyContext(
  value: CompanyContext | Record<string, unknown> | null | undefined,
): CompanyContext | null {
  if (!value || typeof value !== "object") return null;
  const name = asDisplayText(value.name);
  if (!name) return null;
  return value as CompanyContext;
}

export function ContractorContextPanel({
  sessionId,
  businessDescription,
  businessAddress,
  serviceTypes,
  companyContext,
  enrichmentStatus,
  onContextRefresh,
  onEnrichmentStatusChange,
}: ContractorContextProps) {
  const refreshCompanyContext = useAction(api.onboarding.refreshCompanyContext);
  const [refreshing, setRefreshing] = useState(false);

  const ctx = asCompanyContext(companyContext);
  const showExtras = Boolean(
    ctx?.phone ||
      ctx?.email ||
      ctx?.website ||
      ctx?.stats?.rating ||
      ctx?.stats?.employeeCount ||
      (ctx?.people?.length ?? 0) > 0,
  );

  const handleRefresh = useCallback(async () => {
    if (!sessionId) return;
    setRefreshing(true);
    onEnrichmentStatusChange?.("pending");
    try {
      const result = await refreshCompanyContext({ sessionId });
      onContextRefresh?.((result.companyContext as CompanyContext) ?? undefined);
      onEnrichmentStatusChange?.("done");
    } catch {
      onEnrichmentStatusChange?.("failed");
    } finally {
      setRefreshing(false);
    }
  }, [
    sessionId,
    refreshCompanyContext,
    onContextRefresh,
    onEnrichmentStatusChange,
  ]);

  return (
    <aside className="absolute bottom-4 left-4 z-20 w-full max-w-sm rounded-xl border border-amber-300/60 bg-[#fff9f0]/95 p-4 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/70">
        Your business
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-900/65">
        This anchors proximity ranking on the map. Click any house to see household intel.
      </p>

      {businessAddress && (
        <p className="mt-2 text-xs font-medium text-amber-950">{businessAddress}</p>
      )}

      <p className="mt-2 text-sm leading-relaxed text-amber-950">{businessDescription}</p>

      {serviceTypes && serviceTypes.length > 0 && (
        <p className="mt-2 text-xs text-amber-900/70">
          Targeting: {serviceTypes.join(", ")}
        </p>
      )}

      {enrichmentStatus === "pending" && (
        <p className="mt-3 animate-pulse text-[11px] text-amber-900/70">
          Looking up company details in the background…
        </p>
      )}

      {enrichmentStatus === "failed" && !showExtras && (
        <p className="mt-3 text-[11px] text-amber-900/70">
          No public company profile found for this business.
        </p>
      )}

      {showExtras && ctx && (
        <div className="mt-3 space-y-1 border-t border-amber-200/60 pt-3 text-xs text-amber-900/80">
          {ctx.name && ctx.name !== businessAddress && (
            <p className="font-semibold text-amber-950">{ctx.name}</p>
          )}
          {ctx.stats?.rating != null && (
            <p>
              Google: {ctx.stats.rating.toFixed(1)}★
              {ctx.stats.reviewCount ? ` (${ctx.stats.reviewCount} reviews)` : ""}
            </p>
          )}
          {ctx.phone && <p>Phone: {ctx.phone}</p>}
          {ctx.email && <p>Email: {ctx.email}</p>}
          {ctx.website && <p className="truncate">Web: {ctx.website}</p>}
          {(ctx.people?.length ?? 0) > 0 && (
            <p>
              Key contact: {ctx.people?.[0]?.name}
              {ctx.people?.[0]?.role ? ` (${ctx.people[0].role})` : ""}
            </p>
          )}
        </div>
      )}

      {sessionId && enrichmentStatus !== "pending" && (
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {refreshing ? "Refreshing company lookup…" : "Re-run company lookup"}
        </button>
      )}
    </aside>
  );
}
