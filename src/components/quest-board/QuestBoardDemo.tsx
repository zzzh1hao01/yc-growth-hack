"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DEMO_AGENT, DEMO_LEADS } from "@/data/demoSample";
import type { Agent, Lead } from "@/types/lead";
import { filterLeadsByImportance } from "@/lib/lead-utils";
import { BoardLegend } from "./BoardLegend";
import { ContractorContextPanel } from "./ContractorContextPanel";
import { LeadFocusFilter } from "./LeadFocusFilter";
import { LeadSidePanelDemo } from "./LeadSidePanelDemo";
import { OnboardingPanelDemo } from "./OnboardingPanelDemo";
import { QuestMap } from "./QuestMap";

export function QuestBoardDemo() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingKey, setOnboardingKey] = useState(0);
  const [headerPeek, setHeaderPeek] = useState(false);
  const [minLeadScore, setMinLeadScore] = useState(0);

  const panelOpen = selectedLead != null;
  const headerVisible = !panelOpen || headerPeek;
  const leads = DEMO_LEADS;
  const dataSourceLabel = "UI demo · 10 sample pins";

  const visibleLeads = useMemo(
    () => filterLeadsByImportance(leads, { minScore: minLeadScore }),
    [leads, minLeadScore],
  );

  useEffect(() => {
    if (selectedLead && !visibleLeads.some((lead) => lead.id === selectedLead.id)) {
      setSelectedLead(null);
    }
  }, [selectedLead, visibleLeads]);

  const handleOnboardingComplete = useCallback((a: Agent) => {
    setAgent(a);
    setOnboarded(true);
  }, []);

  const handleStartOver = useCallback(() => {
    setSelectedLead(null);
    setAgent(null);
    setOnboarded(false);
    setMinLeadScore(0);
    setHeaderPeek(false);
    setOnboardingKey((k) => k + 1);
  }, []);

  const handleSelectLead = useCallback((lead: Lead) => {
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
    <div className="game-board-shell flex h-screen flex-col overflow-hidden">
      {panelOpen && !headerPeek && (
        <div
          className="game-nav-peek fixed top-0 right-0 left-0 z-[59] h-5 cursor-pointer"
          onMouseEnter={() => setHeaderPeek(true)}
          aria-hidden
        >
          <div className="game-nav-peek-pill mx-auto mt-1" />
        </div>
      )}

      <div
        className="fixed top-0 right-0 left-0 z-[60]"
        onMouseLeave={() => {
          if (panelOpen) setHeaderPeek(false);
        }}
      >
        <header
          className={`game-hud flex h-[var(--quest-header-height)] items-center justify-between gap-3 px-4 transition-transform duration-200 ease-out ${
            headerVisible ? "translate-y-0" : "-translate-y-full pointer-events-none"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="game-icon-badge flex h-8 w-8 shrink-0 items-center justify-center text-base">
              🛡️
            </div>
            <div className="min-w-0">
              <h1 className="game-title truncate text-base leading-tight tracking-tight">
                Coverage Board
              </h1>
              <p className="truncate text-[10px] leading-tight text-amber-900/60">
                HouseholdIQ · UI demo
              </p>
            </div>
          </div>

          <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
            <span className="game-chip hidden max-w-44 truncate sm:inline-block md:max-w-56">
              {agent?.name ?? DEMO_AGENT.name} · {dataSourceLabel}
            </span>
            {onboarded && (
              <LeadFocusFilter
                minScore={minLeadScore}
                visibleCount={visibleLeads.length}
                totalCount={leads.length}
                onChange={setMinLeadScore}
              />
            )}
            {onboarded && <BoardLegend />}
            <button
              type="button"
              onClick={handleStartOver}
              className="game-btn game-btn-ghost shrink-0"
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
          <OnboardingPanelDemo key={onboardingKey} onComplete={handleOnboardingComplete} />
        )}

        {onboarded && (
          <>
            <QuestMap
              leads={visibleLeads}
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
      </main>

      {onboarded && (
        <LeadSidePanelDemo
          lead={selectedLead}
          navVisible={headerVisible}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}

export default QuestBoardDemo;
