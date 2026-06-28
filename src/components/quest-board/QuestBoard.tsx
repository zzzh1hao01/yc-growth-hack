"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { PLACEHOLDER_LEADS } from "@/data/placeholderLeads";
import { getSessionId, resetSession } from "@/lib/session";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Agent, CompanyContext, Lead } from "@/types/lead";
import { filterLeadsByImportance } from "@/lib/lead-utils";
import { BoardLegend } from "./BoardLegend";
import {
  BoardHeaderMenu,
  BoardHeaderMenuItem,
  boardHeaderMenuButtonClassName,
  boardHeaderMenuLinkClassName,
} from "./BoardHeaderMenu";
import { ContractorContextPanel } from "./ContractorContextPanel";
import { LeadFocusFilter } from "./LeadFocusFilter";
import { LeadSidePanel } from "./LeadSidePanel";
import { OnboardingPanel } from "./OnboardingPanel";
import { QuestMap } from "./QuestMap";
import type { LassoState } from "./lasso-state";

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
  const [minLeadScore, setMinLeadScore] = useState(0);
  const [lassoState, setLassoState] = useState<LassoState | null>(null);
  const leadsLoadedRef = useRef(false);
  const [stableLeads, setStableLeads] = useState<Lead[]>([]);

  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const membership = useQuery(
    api.organizations.getMyMembership,
    userId ? { userId } : "skip",
  );

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

  useEffect(() => {
    if (convexLeads === undefined) return;
    leadsLoadedRef.current = true;
    setStableLeads((convexLeads.length > 0 ? convexLeads : []) as Lead[]);
  }, [convexLeads]);

  const leads = useMemo(() => {
    if (!onboarded) {
      return [] as Lead[];
    }

    if (convexLeads === undefined) {
      if (leadsLoadedRef.current) {
        return stableLeads;
      }
      return PLACEHOLDER_LEADS;
    }

    return (convexLeads.length > 0 ? convexLeads : []) as Lead[];
  }, [convexLeads, onboarded, stableLeads]);

  const reconnectingLeads = onboarded && convexLeads === undefined && leadsLoadedRef.current;

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
    setOnboardingKey((k) => k + 1);
    setSessionId(resetSession());
  }, [sessionId, userId, clearContractor, clearAgent]);

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
    <div className="game-board-shell flex h-screen flex-col overflow-hidden">
      <header className="western-hud relative z-50 flex h-[var(--quest-header-height)] shrink-0 items-center justify-between gap-2 overflow-visible px-3 sm:px-4">
        <div className="min-w-0 leading-none">
          <h1 className="western-title truncate text-sm sm:text-base">Coverage Board</h1>
          <p className="western-label mt-0.5 hidden truncate sm:block">HouseholdIQ · SF</p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {onboarded && leads.length > 0 && (
            <LeadFocusFilter
              compact
              minScore={minLeadScore}
              visibleCount={visibleLeads.length}
              totalCount={leads.length}
              onChange={setMinLeadScore}
            />
          )}
          {onboarded && <BoardLegend />}

          <BoardHeaderMenu>
            {onboarded && (
              <BoardHeaderMenuItem>
                <p className="western-label px-3 py-1.5">
                  {agent?.name ?? "Agent"}
                  {Array.isArray(linesOfBusiness) && linesOfBusiness.length > 0 && (
                    <span className="mt-0.5 block truncate font-[family-name:var(--font-body)] normal-case tracking-normal text-[10px] text-amber-900/60">
                      {linesOfBusiness.join(", ")}
                    </span>
                  )}
                </p>
              </BoardHeaderMenuItem>
            )}
            {clerkEnabled && orgId && (
              <>
                <BoardHeaderMenuItem>
                  <Link href="/pipeline" className={boardHeaderMenuLinkClassName()}>
                    Pipeline
                  </Link>
                </BoardHeaderMenuItem>
                <BoardHeaderMenuItem>
                  <Link href="/settings" className={boardHeaderMenuLinkClassName()}>
                    Settings
                  </Link>
                </BoardHeaderMenuItem>
              </>
            )}
            {clerkEnabled && (
              <>
                <Show when="signed-out">
                  <BoardHeaderMenuItem>
                    <SignInButton mode="modal">
                      <button type="button" className={boardHeaderMenuButtonClassName()}>
                        Sign in
                      </button>
                    </SignInButton>
                  </BoardHeaderMenuItem>
                  <BoardHeaderMenuItem>
                    <SignUpButton mode="modal">
                      <button
                        type="button"
                        className={`${boardHeaderMenuButtonClassName()} western-btn-primary border-0 shadow-[2px_2px_0_0_#451a03]`}
                      >
                        Sign up
                      </button>
                    </SignUpButton>
                  </BoardHeaderMenuItem>
                </Show>
                <Show when="signed-in">
                  <BoardHeaderMenuItem>
                    <div className="flex items-center px-3 py-2">
                      <UserButton />
                    </div>
                  </BoardHeaderMenuItem>
                </Show>
              </>
            )}
            <BoardHeaderMenuItem>
              <button
                type="button"
                onClick={() => void handleStartOver()}
                className={boardHeaderMenuButtonClassName()}
              >
                Start over
              </button>
            </BoardHeaderMenuItem>
          </BoardHeaderMenu>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
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
            {reconnectingLeads && (
              <div className="western-toast absolute right-4 top-4 z-30">
                Reconnecting…
              </div>
            )}
            {convexLeads === undefined && !leadsLoadedRef.current && (
              <div className="western-toast absolute right-4 top-4 z-30">
                Loading ~150 leads…
              </div>
            )}
            <QuestMap
              leads={visibleLeads}
              selectedLeadId={selectedLead?.id ?? null}
              lassoState={lassoState}
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
          <div className="western-empty mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="western-title text-lg">No household data loaded</p>
            <p className="western-body">
              The coverage board needs household records in Convex. Run{" "}
              <code className="western-code">scripts/import-insurance-leads.sh</code> then refresh.
            </p>
          </div>
        )}
      </main>

      {onboarded && sessionId && (
        <LeadSidePanel
          lead={selectedLead}
          sessionId={sessionId}
          orgId={orgId}
          userId={userId}
          onClose={handleClosePanel}
          onPursueStart={(leadId) => setLassoState({ leadId, phase: "dragging" })}
          onPursueCaptured={(leadId) => setLassoState({ leadId, phase: "captured" })}
          onPursueEnd={() => setLassoState(null)}
        />
      )}
    </div>
  );
}

export default QuestBoard;
