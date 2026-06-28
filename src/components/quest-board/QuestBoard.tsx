"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { PLACEHOLDER_LEADS } from "@/data/placeholderLeads";
import { getSessionId, resetSession } from "@/lib/session";
import type { CompanyContext, Contractor, Lead } from "@/types/lead";
import { BoardLegend } from "./BoardLegend";
import { ContractorContextPanel } from "./ContractorContextPanel";
import { LeadSidePanel } from "./LeadSidePanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { QuestMap } from "./QuestMap";

export function QuestBoard() {
  const [sessionId, setSessionId] = useState("");
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingKey, setOnboardingKey] = useState(0);
  const [headerPeek, setHeaderPeek] = useState(false);

  const panelOpen = selectedLead != null;
  const headerVisible = !panelOpen || headerPeek;

  const clearContractor = useMutation(api.contractors.clearContractor);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const storedContractor = useQuery(
    api.contractors.getContractor,
    sessionId ? { sessionId } : "skip",
  );

  useEffect(() => {
    if (storedContractor && storedContractor.lat != null && !onboarded) {
      setContractor({
        name: storedContractor.name,
        businessDescription: storedContractor.businessDescription,
        businessAddress: storedContractor.businessAddress,
        lat: storedContractor.lat,
        lng: storedContractor.lng,
        serviceProfile: storedContractor.serviceProfile ?? undefined,
        companyContext: storedContractor.companyContext as CompanyContext | undefined,
        companyEnrichmentStatus: storedContractor.companyEnrichmentStatus ?? undefined,
        businessName: storedContractor.businessName ?? undefined,
        serviceRegionLabel: storedContractor.serviceRegionLabel ?? undefined,
        serviceRegionIds: storedContractor.serviceRegionIds ?? undefined,
      });
      setOnboarded(true);
    }
  }, [storedContractor, onboarded]);

  useEffect(() => {
    if (!onboarded || !storedContractor || storedContractor.lat == null) return;

    setContractor((current) => {
      if (!current) return current;
      return {
        ...current,
        companyContext: storedContractor.companyContext as CompanyContext | undefined,
        companyEnrichmentStatus: storedContractor.companyEnrichmentStatus ?? undefined,
        businessName: storedContractor.businessName ?? current.businessName,
      };
    });
  }, [
    onboarded,
    storedContractor?.companyContext,
    storedContractor?.companyEnrichmentStatus,
  ]);

  const convexLeads = useQuery(
    api.leads.listLeads,
    sessionId && onboarded ? { sessionId } : "skip",
  );

  const { leads, dataSourceLabel } = useMemo(() => {
    if (!onboarded) {
      return { leads: [] as Lead[], dataSourceLabel: "Awaiting setup" };
    }

    if (convexLeads === undefined) {
      return { leads: PLACEHOLDER_LEADS, dataSourceLabel: "Loading…" };
    }

    if (convexLeads.length > 0) {
      return {
        leads: convexLeads as Lead[],
        dataSourceLabel: "Demo · Sunset / Parkside · ranked near you",
      };
    }

    return {
      leads: [] as Lead[],
      dataSourceLabel: "No household data loaded",
    };
  }, [convexLeads, onboarded]);

  const handleOnboardingComplete = useCallback((c: Contractor) => {
    setContractor(c);
    setOnboarded(true);
  }, []);

  const handleStartOver = useCallback(async () => {
    if (sessionId) {
      await clearContractor({ sessionId });
    }
    setSelectedLead(null);
    setContractor(null);
    setOnboarded(false);
    setOnboardingKey((k) => k + 1);
    setSessionId(resetSession());
  }, [sessionId, clearContractor]);

  const handleSelectLead = useCallback((lead: Lead) => {
    if (!lead.convexId) return;
    setHeaderPeek(false);
    setSelectedLead(lead);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedLead(null);
    setHeaderPeek(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClosePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClosePanel]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5e6c8]">
      {panelOpen && !headerPeek && (
        <div
          className="fixed top-0 right-0 left-0 z-[59] h-5 cursor-pointer"
          onMouseEnter={() => setHeaderPeek(true)}
          aria-hidden
        >
          <div className="mx-auto mt-1 h-1 w-16 rounded-full bg-amber-800/25" />
        </div>
      )}

      <div
        className="fixed top-0 right-0 left-0 z-[60]"
        onMouseLeave={() => {
          if (panelOpen) setHeaderPeek(false);
        }}
      >
        <header
          className={`flex h-[var(--quest-header-height)] items-center justify-between gap-3 border-b border-amber-300/50 bg-[#f5e6c8] px-4 shadow-sm transition-transform duration-200 ease-out ${
            headerVisible ? "translate-y-0" : "-translate-y-full pointer-events-none"
          }`}
        >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-800 text-base shadow-md">
            🏠
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight tracking-tight text-amber-950">
              Bounty Board
            </h1>
            <p className="truncate text-[10px] leading-tight text-amber-900/60">
              HouseholdIQ · San Francisco
            </p>
          </div>
        </div>

        <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
          <span
            className="hidden max-w-[11rem] truncate rounded-full border border-amber-400/60 bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold text-amber-950 sm:inline-block md:max-w-[14rem]"
            title={`${contractor?.name ?? "Contractor"} · ${dataSourceLabel}`}
          >
            {contractor?.name ?? "Contractor"} · {dataSourceLabel}
          </span>
          {onboarded && <BoardLegend />}
          <button
            type="button"
            onClick={() => void handleStartOver()}
            className="shrink-0 rounded-full border border-amber-400/80 bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900 transition hover:bg-amber-100 sm:px-3 sm:py-1 sm:text-xs"
          >
            Start over
          </button>
        </div>
      </header>
      </div>

      <main
        className={`relative min-h-0 flex-1 transition-[padding] duration-200 ${
          headerVisible ? "pt-[var(--quest-header-height)]" : "pt-0"
        }`}
      >
        {!onboarded && (
          <OnboardingPanel key={onboardingKey} onComplete={handleOnboardingComplete} />
        )}

        {onboarded && leads.length > 0 && (
          <>
            {convexLeads === undefined && (
              <div className="absolute right-4 top-4 z-30 rounded-full border border-amber-300/70 bg-white/90 px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm">
                Ranking 30 nearby leads…
              </div>
            )}
            <QuestMap
              leads={leads}
              selectedLeadId={selectedLead?.id ?? null}
              onSelectLead={handleSelectLead}
              businessLocation={
                contractor?.lat != null && contractor?.lng != null
                  ? {
                      lat: contractor.lat,
                      lng: contractor.lng,
                      label: contractor.businessAddress,
                    }
                  : null
              }
            />
            {contractor && (
              <ContractorContextPanel
                businessName={contractor.businessName}
                businessAddress={contractor.businessAddress}
                serviceTypes={contractor.serviceProfile?.service_types}
                companyContext={contractor.companyContext}
                enrichmentStatus={contractor.companyEnrichmentStatus}
              />
            )}
          </>
        )}

        {onboarded && convexLeads !== undefined && leads.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-lg font-bold text-amber-950">No household data loaded</p>
            <p className="max-w-md text-sm text-amber-900/70">
              The demo bounty board needs Sunset / Parkside household records in Convex. Run{" "}
              <code className="rounded bg-white/80 px-1 py-0.5 text-xs">scripts/import-sunset-leads.sh</code>{" "}
              or seed the database, then refresh.
            </p>
          </div>
        )}
      </main>

      {onboarded && sessionId && (
        <LeadSidePanel
          lead={selectedLead}
          sessionId={sessionId}
          navVisible={headerVisible}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}

export default QuestBoard;
