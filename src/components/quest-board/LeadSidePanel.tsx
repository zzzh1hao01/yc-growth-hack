import type { Lead } from "@/types/lead";
import {
  getMatchTier,
  getScoreBarColor,
  getTierLabel,
} from "@/lib/lead-utils";

type LeadSidePanelProps = {
  lead: Lead | null;
  onClose: () => void;
};

function PlaceholderValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="italic text-amber-800/50" title="Placeholder — populate via ETL">
      {children}
    </span>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LeadSidePanel({ lead, onClose }: LeadSidePanelProps) {
  if (!lead) return null;

  const tier = getMatchTier(lead.matchScore);
  const barColor = getScoreBarColor(lead.matchScore);
  const isPlaceholder = lead.dataSource === "placeholder" || !lead.dataSource;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none"
        onClick={onClose}
        aria-label="Close panel"
      />
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-amber-200/60 bg-[#fff9f0] shadow-2xl animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-labelledby="lead-panel-title"
      >
        <div className="flex items-center justify-between border-b border-amber-200/60 bg-[#f5e6c8] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800/70">
              Bounty Details
              {isPlaceholder && (
                <span className="ml-2 rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] normal-case">
                  demo data
                </span>
              )}
            </p>
            <h2 id="lead-panel-title" className="text-lg font-bold text-amber-950">
              {lead.address}
            </h2>
            {lead.neighborhood && (
              <p className="text-xs text-amber-800/60">{lead.neighborhood}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-amber-900/60 transition hover:bg-amber-200/50 hover:text-amber-950"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <section className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-950">Match Score</span>
              <span className="text-sm font-bold" style={{ color: barColor }}>
                {lead.matchScore}/100 · {getTierLabel(tier)}
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${lead.matchScore}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            {lead.urgent && (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-red-600">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  !
                </span>
                Urgent — permit exceeds replacement threshold
              </p>
            )}
            {lead.distanceMiles != null && (
              <p className="mt-2 text-xs text-amber-800/70">
                {lead.distanceMiles.toFixed(1)} mi from your business
              </p>
            )}
          </section>

          <section className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800/70">
              Property Signals
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-amber-900/70">Last permit age</dt>
                <dd className="font-semibold text-amber-950 text-right">
                  {lead.permitAgeYears} years
                </dd>
              </div>
              {lead.lastPermitType ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Permit type</dt>
                  <dd className="font-semibold text-amber-950 text-right">
                    {lead.lastPermitType}
                  </dd>
                </div>
              ) : isPlaceholder ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Permit type</dt>
                  <dd className="text-right">
                    <PlaceholderValue>ETL: SF permit taxonomy</PlaceholderValue>
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-amber-900/70">Home age</dt>
                <dd className="font-semibold text-amber-950 text-right">
                  {lead.homeAgeYears} years
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-amber-900/70">Owner status</dt>
                <dd className="font-semibold text-amber-950 text-right">
                  {lead.ownerOccupied != null ? (
                    lead.ownerOccupied ? "Owner-occupied" : "Renter / unknown"
                  ) : (
                    <PlaceholderValue>ETL: Assessor flag</PlaceholderValue>
                  )}
                </dd>
              </div>
              {lead.assessedValue != null ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Assessed value</dt>
                  <dd className="font-semibold text-amber-950 text-right">
                    {formatCurrency(lead.assessedValue)}
                  </dd>
                </div>
              ) : isPlaceholder ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Assessed value</dt>
                  <dd className="text-right">
                    <PlaceholderValue>ETL: Assessor parcel</PlaceholderValue>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-800/70">
              Household Cluster
            </h3>
            <p className="text-sm leading-relaxed text-amber-950">{lead.cluster}</p>
            {lead.clusterId && (
              <p className="mt-1 text-xs text-amber-800/50">ID: {lead.clusterId}</p>
            )}
            <p className="mt-3 text-xs italic text-amber-800/60">
              Persona chat coming soon — see docs/DATA_INTEGRATION.md
            </p>
          </section>

          {isPlaceholder && (
            <section className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50/50 p-4">
              <p className="text-xs leading-relaxed text-amber-900/70">
                <strong>For agents:</strong> Replace demo data by ingesting geocoded
                addresses into <code className="rounded bg-white px-1">convex/leads.ts</code>.
                See <code className="rounded bg-white px-1">docs/DATA_INTEGRATION.md</code>.
              </p>
            </section>
          )}
        </div>

        <div className="border-t border-amber-200/60 bg-[#f5e6c8]/50 p-5">
          <button
            type="button"
            disabled
            className="w-full rounded-xl bg-amber-900/30 px-4 py-3 text-sm font-bold text-amber-950/50 cursor-not-allowed"
            title="Orange Slice integration coming soon"
          >
            Get contact info
          </button>
          <p className="mt-2 text-center text-xs text-amber-800/50">
            Enrichment via Orange Slice — not wired in demo
          </p>
        </div>
      </aside>
    </>
  );
}
