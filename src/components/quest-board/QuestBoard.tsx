"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { PLACEHOLDER_LEADS } from "@/data/placeholderLeads";
import { getSessionId, resetSession } from "@/lib/session";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Agent, CompanyContext, Lead } from "@/types/lead";
import { filterLeadsByImportance } from "@/lib/lead-utils";
import { BoardLegend } from "./BoardLegend";
import { ContractorContextPanel } from "./ContractorContextPanel";
import { LeadFocusFilter } from "./LeadFocusFilter";
import { LeadSidePanel } from "./LeadSidePanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { QuestMap } from "./QuestMap";

export function QuestBoard({
  userId,
  orgId,
}: {
  userId?: string;
  orgId?: Id<"organizations">;
} = {}) {
  const [sessionId, setSessionId] = useState("");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [onboardingKey, setOnboardingKey] = useState(0);
  const [headerPeek, setHeaderPeek] = useState(false);
  const [minLeadScore, setMinLeadScore] = useState(0);

  const panelOpen = selectedLead != null;
  const headerVisible = !panelOpen || headerPeek;
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const clearContractor = useMutation(api.contractors.clearContractor);
  const clearAgent = useMutation(api.agents.clearAgent);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const storedAgent = useQuery(
    api.agents.getAgent,
    sessionId || userId ? { sessionId: sessionId || undefined, userId } : "skip",
  );

  useEffect(() => {
    if (storedAgent && storedAgent.lat != null && !onboarded) {
      setAgent({
        name: storedAgent.name,
        businessDescription: storedAgent.businessDescription,
        businessAddress: storedAgent.businessAddress,
        lat: storedAgent.lat,
        lng: storedAgent.lng,
        serviceProfile: (storedAgent.serviceProfile ?? undefined) as Agent["serviceProfile"],
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
    sessionId && onboarded ? { sessionId, userId } : "skip",
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
        dataSourceLabel: "Insurance leads · citywide sample (max 400)",
      };
    }

    return {
      leads: [] as Lead[],
      dataSourceLabel: "No household data loaded",
    };
  }, [convexLeads, onboarded]);

  const visibleLeads = useMemo(
    () => filterLeadsByImportance(leads, { minScore: minLeadScore }),
    [leads, minLeadScore],
  );

  useEffect(() => {
    if (
      selectedLead &&
      !visibleLeads.some((lead) => lead.id === selectedLead.id)
    ) {
      setSelectedLead(null);
    }
  }, [selectedLead, visibleLeads]);

  const handleOnboardingComplete = useCallback((a: Agent) => {
    setAgent(a);
    setOnboarded(true);
  }, []);

  const handleStartOver = useCallback(async () => {
    if (sessionId) {
      await clearContractor({ sessionId });
    }
    if (userId) {
      await clearAgent({ userId });
    }
    setSelectedLead(null);
    setAgent(null);
    setOnboarded(false);
    setMinLeadScore(0);
    setHeaderPeek(false);
    setOnboardingKey((k) => k + 1);
    setSessionId(resetSession());
  }, [sessionId, userId, clearContractor, clearAgent]);

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

  const linesOfBusiness = agent?.serviceProfile?.lines_of_business;

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
                HouseholdIQ · San Francisco
              </p>
            </div>
          </div>

          <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
            <span
              className="game-chip hidden max-w-44 truncate sm:inline-block md:max-w-56"
              title={`${agent?.name ?? "Agent"} · ${dataSourceLabel}`}
            >
              {agent?.name ?? "Agent"} · {dataSourceLabel}
            </span>
            {onboarded && leads.length > 0 && (
              <LeadFocusFilter
                minScore={minLeadScore}
                visibleCount={visibleLeads.length}
                totalCount={leads.length}
                onChange={setMinLeadScore}
              />
            )}
            {onboarded && <BoardLegend />}
            {clerkEnabled && orgId && (
              <>
                <Link href="/pipeline" className="game-btn game-btn-ghost hidden sm:inline-flex">
                  Pipeline
                </Link>
                <Link href="/settings" className="game-btn game-btn-ghost hidden sm:inline-flex">
                  Settings
                </Link>
              </>
            )}
            {clerkEnabled && (
              <>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button type="button" className="game-btn game-btn-ghost">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button type="button" className="game-btn game-btn-primary">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </>
            )}
            <button
              type="button"
              onClick={() => void handleStartOver()}
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
          <OnboardingPanel
            key={onboardingKey}
            userId={userId}
            orgId={orgId}
            onComplete={handleOnboardingComplete}
          />
        )}

        {onboarded && leads.length > 0 && (
          <>
            {convexLeads === undefined && (
              <div className="game-toast absolute right-4 top-4 z-30">
                Loading ~400 leads…
              </div>
            )}
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

        {onboarded && convexLeads !== undefined && leads.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="game-title text-lg">No household data loaded</p>
            <p className="max-w-md text-sm text-amber-900/70">
              The insurance coverage board needs household records in Convex. Run{" "}
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
          navVisible={headerVisible}
          orgId={orgId}
          userId={userId}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}

export default QuestBoard;
