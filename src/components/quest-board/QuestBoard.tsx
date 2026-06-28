"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { PLACEHOLDER_LEADS } from "@/data/placeholderLeads";
import { getSessionId, resetSession } from "@/lib/session";
import type { Agent, CompanyContext, Lead } from "@/types/lead";
import { BoardLegend } from "./BoardLegend";
import { ContractorContextPanel } from "./ContractorContextPanel";
import { LeadSidePanel } from "./LeadSidePanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { QuestMap } from "./QuestMap";

export function QuestBoard() {
  const [sessionId, setSessionId] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingKey, setOnboardingKey] = useState(0);

  const clearContractor = useMutation(api.contractors.clearContractor);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const storedAgent = useQuery(
    api.contractors.getContractor,
    sessionId ? { sessionId } : "skip",
  );

  useEffect(() => {
    if (storedAgent && storedAgent.lat != null && !onboarded) {
      setAgent({
        name: storedAgent.name,
        businessDescription: storedAgent.businessDescription,
        businessAddress: storedAgent.businessAddress,
        lat: storedAgent.lat,
        lng: storedAgent.lng,
        serviceProfile: storedAgent.serviceProfile ?? undefined,
        companyContext: storedAgent.companyContext as CompanyContext | undefined,
        companyEnrichmentStatus: storedAgent.companyEnrichmentStatus ?? undefined,
        businessName: storedAgent.businessName ?? undefined,
        serviceRegionLabel: storedAgent.serviceRegionLabel ?? undefined,
        serviceRegionIds: storedAgent.serviceRegionIds ?? undefined,
        targetNeighborhoods: storedAgent.targetNeighborhoods ?? undefined,
      });
      setOnboarded(true);
    }
  }, [storedAgent, onboarded]);

  useEffect(() => {
    if (!onboarded || !storedAgent || storedAgent.lat == null) return;

    setAgent((current) => {
      if (!current) return current;
      return {
        ...current,
        companyContext: storedAgent.companyContext as CompanyContext | undefined,
        companyEnrichmentStatus: storedAgent.companyEnrichmentStatus ?? undefined,
        businessName: storedAgent.businessName ?? current.businessName,
      };
    });
  }, [
    onboarded,
    storedAgent?.companyContext,
    storedAgent?.companyEnrichmentStatus,
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
        dataSourceLabel: "Insurance leads · ranked by need + timing",
      };
    }

    return {
      leads: [] as Lead[],
      dataSourceLabel: "No household data loaded",
    };
  }, [convexLeads, onboarded]);

  const handleOnboardingComplete = useCallback((a: Agent) => {
    setAgent(a);
    setOnboarded(true);
  }, []);

  const handleStartOver = useCallback(async () => {
    if (sessionId) {
      await clearContractor({ sessionId });
    }
    setSelectedLead(null);
    setAgent(null);
    setOnboarded(false);
    setOnboardingKey((k) => k + 1);
    setSessionId(resetSession());
  }, [sessionId, clearContractor]);

  const handleSelectLead = useCallback((lead: Lead) => {
    if (!lead.convexId) return;
    setSelectedLead(lead);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedLead(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClosePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClosePanel]);

  const linesOfBusiness = agent?.serviceProfile?.lines_of_business;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5e6c8]">
      <header className="z-50 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-amber-300/50 bg-[#f5e6c8] px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-800 text-lg shadow-md">
            🏠
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-amber-950">
              Coverage Board
            </h1>
            <p className="text-xs text-amber-900/60">HouseholdIQ · San Francisco</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="rounded-full border border-amber-400/60 bg-white/70 px-3 py-1 text-xs font-semibold text-amber-950">
            {agent?.name ?? "Agent"} · {dataSourceLabel}
          </span>
          {Array.isArray(linesOfBusiness) && linesOfBusiness.length > 0 && (
            <span className="hidden text-xs text-amber-900/70 sm:inline">
              {linesOfBusiness.join(", ")} · {agent?.serviceProfile?.price_point} tier
            </span>
          )}
          {onboarded && <BoardLegend />}
          <button
            type="button"
            onClick={() => void handleStartOver()}
            className="rounded-full border border-amber-400/80 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Start over
          </button>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {!onboarded && (
          <OnboardingPanel key={onboardingKey} onComplete={handleOnboardingComplete} />
        )}

        {onboarded && leads.length > 0 && (
          <>
            {convexLeads === undefined && (
              <div className="absolute right-4 top-4 z-30 rounded-full border border-amber-300/70 bg-white/90 px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm">
                Ranking leads by need + timing…
              </div>
            )}
            <QuestMap
              leads={leads}
              selectedLeadId={selectedLead?.id ?? null}
              onSelectLead={handleSelectLead}
              businessLocation={
                agent?.lat != null && agent?.lng != null
                  ? {
                      lat: agent.lat,
                      lng: agent.lng,
                      label: agent.businessAddress,
                    }
                  : null
              }
            />
            {agent && (
              <ContractorContextPanel
                businessName={agent.businessName}
                businessAddress={agent.businessAddress}
                serviceTypes={agent.serviceProfile?.lines_of_business}
                companyContext={agent.companyContext}
                enrichmentStatus={agent.companyEnrichmentStatus}
              />
            )}
          </>
        )}

        {onboarded && convexLeads !== undefined && leads.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-lg font-bold text-amber-950">No household data loaded</p>
            <p className="max-w-md text-sm text-amber-900/70">
              The insurance bounty board needs household records in Convex. Run{" "}
              <code className="rounded bg-white/80 px-1 py-0.5 text-xs">
                scripts/import-insurance-leads.sh
              </code>{" "}
              then refresh.
            </p>
          </div>
        )}
      </main>

      {onboarded && sessionId && (
        <LeadSidePanel
          lead={selectedLead}
          sessionId={sessionId}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}

export default QuestBoard;
