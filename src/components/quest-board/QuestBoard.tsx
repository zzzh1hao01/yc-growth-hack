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
import {
  DEFAULT_TIER_VISIBILITY,
  filterLeadsByImportance,
  filterLeadsByTierVisibility,
  type TierVisibility,
} from "@/lib/lead-utils";
import { BoardLegend } from "./BoardLegend";
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
  const [minLeadScore, setMinLeadScore] = useState(0);
  const [tierVisibility, setTierVisibility] = useState<TierVisibility>(
    DEFAULT_TIER_VISIBILITY,
  );

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
    () =>
      filterLeadsByTierVisibility(
        filterLeadsByImportance(leads, { minScore: minLeadScore }),
        tierVisibility,
      ),
    [leads, minLeadScore, tierVisibility],
  );

  const handleTierToggle = useCallback((tier: keyof TierVisibility) => {
    setTierVisibility((prev) => ({ ...prev, [tier]: !prev[tier] }));
  }, []);

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
    setTierVisibility(DEFAULT_TIER_VISIBILITY);
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

  return (
    <div className="game-board-shell flex h-screen flex-col overflow-hidden">
      <header className="western-hud z-50 flex h-[var(--quest-header-height)] shrink-0 items-center justify-between gap-3 px-4">
        <h1 className="western-title shrink-0 text-sm sm:text-base">Coverage Board</h1>

        <div className="flex min-w-0 shrink flex-wrap items-center justify-end gap-2 sm:gap-3">
          {onboarded && leads.length > 0 && (
            <LeadFocusFilter
              minScore={minLeadScore}
              visibleCount={visibleLeads.length}
              totalCount={leads.length}
              onChange={setMinLeadScore}
            />
          )}
          {onboarded && leads.length > 0 && (
            <BoardLegend
              leads={leads}
              visibility={tierVisibility}
              onToggle={handleTierToggle}
            />
          )}
          {clerkEnabled && orgId && (
            <>
              <Link
                href="/pipeline"
                className="rounded-full border border-amber-400/80 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                Pipeline
              </Link>
              <Link
                href="/settings"
                className="rounded-full border border-amber-400/80 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                Settings
              </Link>
            </>
          )}
          {clerkEnabled && (
            <>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="rounded-full border border-amber-400/80 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                  >
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="rounded-full bg-amber-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-800"
                  >
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
            className="rounded-full border border-amber-400/80 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
          >
            Start over
          </button>
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
          orgId={orgId}
          userId={userId}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}

export default QuestBoard;
