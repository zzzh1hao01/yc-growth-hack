"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { PLACEHOLDER_LEADS, type Lead } from "@/data/placeholderLeads";
import { BoardLegend } from "./BoardLegend";
import { LeadSidePanel } from "./LeadSidePanel";
import { QuestMap } from "./QuestMap";

export function QuestBoard() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const convexLeads = useQuery(
    api.leads.listLeads,
    process.env.NEXT_PUBLIC_CONVEX_URL ? {} : "skip",
  );

  const { leads, dataSourceLabel } = useMemo(() => {
    if (convexLeads === undefined) {
      return {
        leads: PLACEHOLDER_LEADS,
        dataSourceLabel: "Loading…",
      };
    }

    if (convexLeads.length > 0) {
      return {
        leads: convexLeads as Lead[],
        dataSourceLabel: "Convex · householdiq",
      };
    }

    return {
      leads: PLACEHOLDER_LEADS,
      dataSourceLabel: "Demo placeholders",
    };
  }, [convexLeads]);

  const handleSelectLead = useCallback((lead: Lead) => {
    setSelectedLead(lead);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedLead(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClosePanel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClosePanel]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5e6c8]">
      <header className="z-50 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-amber-300/50 bg-[#f5e6c8] px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-800 text-lg shadow-md">
            🏠
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-amber-950">
              Bounty Board
            </h1>
            <p className="text-xs text-amber-900/60">HouseholdIQ · San Francisco</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="rounded-full border border-amber-400/60 bg-white/70 px-3 py-1 text-xs font-semibold text-amber-950">
            Mission HVAC Co. · {dataSourceLabel}
          </span>
          <BoardLegend />
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {convexLeads === undefined && process.env.NEXT_PUBLIC_CONVEX_URL ? (
          <div className="flex h-full items-center justify-center">
            <p className="animate-pulse font-semibold text-amber-950">
              Loading leads from Convex…
            </p>
          </div>
        ) : (
          <QuestMap
            leads={leads}
            selectedLeadId={selectedLead?.id ?? null}
            onSelectLead={handleSelectLead}
          />
        )}
      </main>

      <LeadSidePanel lead={selectedLead} onClose={handleClosePanel} />
    </div>
  );
}

export default QuestBoard;
