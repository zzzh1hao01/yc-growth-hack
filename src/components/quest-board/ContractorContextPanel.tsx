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
  onContextRefresh?: (context: CompanyContext | undefined) => void;
};

function asCompanyContext(
  value: CompanyContext | Record<string, unknown> | null | undefined,
): CompanyContext | null {
  if (!value || typeof value !== "object") return null;
  const name = asDisplayText(value.name);
  if (!name) return null;
  return value as CompanyContext;
}

function Stat({ label, value }: { label: string; value?: string | number }) {
  if (value == null || value === "") return null;
  return (
    <div className="rounded-lg bg-amber-50/80 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-amber-800/55">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-amber-950">{value}</p>
    </div>
  );
}

function hasProfileDetails(ctx: CompanyContext): boolean {
  const stats = ctx.stats;
  return Boolean(
    ctx.headline ||
      ctx.about ||
      ctx.phone ||
      ctx.email ||
      ctx.website ||
      ctx.linkedinUrl ||
      (ctx.people?.length ?? 0) > 0 ||
      (ctx.socialLinks?.length ?? 0) > 0 ||
      stats?.employeeCount ||
      stats?.founded ||
      stats?.rating ||
      stats?.industry ||
      stats?.primaryType ||
      (ctx.contacts?.phones?.length ?? 0) > 0 ||
      (ctx.contacts?.emails?.length ?? 0) > 0,
  );
}

export function ContractorContextPanel({
  sessionId,
  businessDescription,
  businessAddress,
  serviceTypes,
  companyContext,
  onContextRefresh,
}: ContractorContextProps) {
  const refreshCompanyContext = useAction(api.onboarding.refreshCompanyContext);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const ctx = asCompanyContext(companyContext);
  const stats = ctx?.stats;
  const contacts = ctx?.contacts;
  const people = ctx?.people ?? [];
  const fiberLookups = ctx?.fiberLookups ?? [];
  const hasDetails = ctx ? hasProfileDetails(ctx) : false;
  const needsRefresh = ctx && fiberLookups.length === 0;

  const handleRefresh = useCallback(async () => {
    if (!sessionId) return;
    setRefreshError(null);
    setRefreshing(true);
    try {
      const result = await refreshCompanyContext({ sessionId });
      onContextRefresh?.((result.companyContext as CompanyContext) ?? undefined);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [sessionId, refreshCompanyContext, onContextRefresh]);

  return (
    <aside className="absolute bottom-4 left-4 z-20 w-full max-w-md rounded-xl border border-amber-300/60 bg-[#fff9f0]/95 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/70">
          Your business intelligence
        </p>
        {sessionId && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0 rounded-md border border-amber-300/80 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 transition hover:bg-amber-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh intel"}
          </button>
        )}
      </div>

      {refreshError && (
        <p className="mt-2 rounded-lg bg-red-100 px-2 py-1 text-[11px] text-red-800">
          {refreshError}
        </p>
      )}

      {ctx ? (
        <div className="mt-2 space-y-3">
          <div>
            <p className="text-sm font-semibold text-amber-950">{ctx.name}</p>
            {ctx.headline && (
              <p className="mt-1 text-xs leading-relaxed text-amber-900/75">{ctx.headline}</p>
            )}
            {ctx.address && (
              <p className="mt-1 text-xs text-amber-900/70">{ctx.address}</p>
            )}
          </div>

          {!hasDetails && (
            <p className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-2 py-2 text-[11px] leading-relaxed text-amber-900/80">
              Fiber ran but this business has a thin public footprint — no LinkedIn company
              record, owner contacts, or extra channels matched. Try picking the exact Google
              business name from address autocomplete, or use a well-known company (e.g. Magic
              Plumbing) to see the full profile.
            </p>
          )}

          {(stats?.employeeCount ||
            stats?.founded ||
            stats?.rating ||
            stats?.industry ||
            stats?.primaryType) && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Industry" value={stats.industry ?? stats.primaryType} />
              <Stat label="Employees" value={stats.employeeCount} />
              <Stat label="Founded" value={stats.founded} />
              <Stat
                label="Google rating"
                value={
                  stats.rating
                    ? `${stats.rating.toFixed(1)}★${
                        stats.reviewCount ? ` (${stats.reviewCount})` : ""
                      }`
                    : undefined
                }
              />
            </div>
          )}

          {ctx.about && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/60">
                About
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/80">{ctx.about}</p>
            </div>
          )}

          {(ctx.phone ||
            ctx.email ||
            ctx.website ||
            (contacts?.phones?.length ?? 0) > 0 ||
            (contacts?.emails?.length ?? 0) > 0) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/60">
                Contact channels
              </p>
              <ul className="mt-1 space-y-1 text-xs text-amber-900/80">
                {uniqueList([ctx.phone, ...(contacts?.phones ?? [])]).map((phone) => (
                  <li key={phone}>Phone: {phone}</li>
                ))}
                {uniqueList([ctx.email, ...(contacts?.emails ?? [])]).map((email) => (
                  <li key={email}>Email: {email}</li>
                ))}
                {ctx.website && <li className="truncate">Web: {ctx.website}</li>}
                {ctx.linkedinUrl && (
                  <li className="truncate">LinkedIn: {ctx.linkedinUrl}</li>
                )}
              </ul>
            </div>
          )}

          {people.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/60">
                Key people
              </p>
              <ul className="mt-1 space-y-2">
                {people.slice(0, 4).map((person) => (
                  <li key={`${person.name}-${person.role ?? ""}`} className="text-xs text-amber-900/85">
                    <span className="font-semibold text-amber-950">{person.name}</span>
                    {person.role ? ` · ${person.role}` : ""}
                    {person.email ? <div className="text-amber-900/70">{person.email}</div> : null}
                    {person.phone ? <div className="text-amber-900/70">{person.phone}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ctx.socialLinks && ctx.socialLinks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/60">
                Social
              </p>
              <ul className="mt-1 space-y-1 text-xs text-amber-900/75">
                {ctx.socialLinks.slice(0, 4).map((link) => (
                  <li key={link.url}>
                    {link.platform}: {link.url}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(fiberLookups.length > 0 || needsRefresh) && (
            <div className="rounded-lg border border-amber-200/70 bg-white/70 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/60">
                What Fiber looked up
              </p>
              {needsRefresh ? (
                <p className="mt-1 text-[11px] leading-relaxed text-amber-900/75">
                  This profile was saved before enrichment logging. Click{" "}
                  <span className="font-medium text-amber-950">Refresh intel</span> to re-run
                  Fiber (~6 credits) and see what each API returned.
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-amber-900/75">
                  {fiberLookups.map((lookup, index) => (
                    <li key={`${lookup.api}-${index}`}>
                      <span className="font-medium text-amber-950">{lookup.api}</span>
                      {lookup.credits != null ? ` · ${lookup.credits} credits` : ""}
                      {" — "}
                      {lookup.summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : businessAddress ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-900/75">{businessAddress}</p>
      ) : (
        <p className="mt-1 text-xs text-amber-800/60">
          Fiber enriches your company profile, contacts, and key people after onboarding.
        </p>
      )}

      <div className="mt-3 border-t border-amber-200/60 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/60">
          Your pitch
        </p>
        <p className="mt-1 text-sm leading-relaxed text-amber-950">{businessDescription}</p>
        {serviceTypes && serviceTypes.length > 0 && (
          <p className="mt-2 text-xs text-amber-900/70">
            Targeting: {serviceTypes.join(", ")}
          </p>
        )}
      </div>
    </aside>
  );
}

function uniqueList(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])];
}
