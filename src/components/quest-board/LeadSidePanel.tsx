"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { EnrichmentResult, Lead, OutreachChannel, Persona, StartOutreachResult } from "@/types/lead";
import { OUTREACH_ENABLED } from "@/types/lead";
import { asDisplayText, personaColdApproach, personaObjections, personaParagraphs } from "@/lib/safe-text";
import { getMatchTier, getTierColor } from "@/lib/lead-utils";

type LeadSidePanelProps = {
  lead: Lead | null;
  sessionId: string;
  orgId?: Id<"organizations">;
  userId?: string;
  onClose: () => void;
  onPursueStart?: (leadId: string) => void;
  onPursueCaptured?: (leadId: string) => void;
  onPursueEnd?: () => void;
};

const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn",
  mail: "Direct mail",
  d2d: "Door knock",
};

const OUTREACH_STATUS_LABELS: Record<string, string> = {
  queued: "Queued for Orange Slice import",
  sheet_synced: "In Orange Slice sheet",
  touch1_ready: "Ready to contact",
  touch1_sent: "Touch 1 sent",
  touch2_sent: "Touch 2 sent",
  replied: "Replied",
  meeting: "Meeting booked",
  won: "Won",
  lost: "Lost",
  d2d_planned: "Door knock planned",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function riskRationale(lead: Lead): string {
  const parts: string[] = [];
  if (lead.replacementCostGapPct != null) {
    parts.push(
      `${Math.round(lead.replacementCostGapPct * 100)}% rebuild cost gap` +
        (lead.replacementCostGapDollars != null
          ? ` (${formatCurrency(lead.replacementCostGapDollars)} underinsured)`
          : ""),
    );
  }
  if (lead.homeAgeYears) parts.push(`${lead.homeAgeYears}-year-old home`);
  if (lead.yearsOwned != null && lead.purchaseYear != null) {
    parts.push(`owned since ${lead.purchaseYear} — coverage likely anchored to purchase price`);
  }
  return parts.join(". ") || lead.cluster || "Coverage risk signals present.";
}

function timingRationale(lead: Lead): string {
  const parts: string[] = [];
  if (lead.timingConfidence === "high") parts.push("High-confidence timing signal");
  else if (lead.timingConfidence === "low") parts.push("Moderate timing signal");
  if (lead.purchaseYear != null)
    parts.push(`policy likely in place since ~${lead.purchaseYear}`);
  if (lead.timingScore != null) {
    const pct = Math.round(lead.timingScore * 100);
    if (pct >= 70) parts.push("well-timed for a review conversation");
    else if (pct >= 40) parts.push("moderate opening");
    else parts.push("early outreach — relationship-building phase");
  }
  return parts.join(" — ") || "Timing derived from tenure and estimated policy age.";
}

function fitRationale(lead: Lead): string {
  const parts: string[] = [];
  if (lead.archetype) parts.push(lead.archetype);
  else if (lead.cluster) parts.push(lead.cluster);
  const fit = lead.fitScore ?? lead.acsReceptivityScore;
  if (fit != null) {
    const pct = Math.round(fit * 100);
    if (pct >= 70) parts.push("high receptivity to financial product outreach");
    else if (pct >= 40) parts.push("moderate receptivity");
    else parts.push("lower receptivity — lead with a data-backed hook");
  }
  if (lead.ownerOccupied) parts.push("owner-occupied household");
  if (lead.neighborhood) parts.push(`${lead.neighborhood} neighborhood profile`);
  return parts.join(". ") || "Fit based on census-derived household behavioral cluster.";
}

function priorityLabel(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 70) return { label: "High priority", color: "text-green-800", bg: "bg-green-50", border: "border-green-200" };
  if (score >= 40) return { label: "Medium priority", color: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200" };
  return { label: "Low priority", color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };
}

function priorityFactors(lead: Lead): string[] {
  const factors: string[] = [];
  if (lead.replacementCostGapPct != null && lead.replacementCostGapPct >= 0.2) {
    factors.push(
      `${Math.round(lead.replacementCostGapPct * 100)}% rebuild cost gap` +
        (lead.replacementCostGapDollars != null
          ? ` — ${formatCurrency(lead.replacementCostGapDollars)} underinsured`
          : ""),
    );
  }
  if (lead.yearsOwned != null && lead.yearsOwned >= 10 && lead.purchaseYear != null) {
    factors.push(`Owned since ${lead.purchaseYear} — policy likely anchored to original price`);
  }
  if (lead.timingConfidence === "high" && (lead.timingScore ?? 0) >= 0.3) {
    factors.push("High-confidence timing window for a review conversation");
  } else if (lead.timingScore != null && lead.timingScore >= 0.5) {
    factors.push("Moderate timing signal — good moment to reach out");
  }
  if (lead.homeAgeYears >= 50) {
    factors.push(`${lead.homeAgeYears}-year-old home — elevated structural risk`);
  }
  if (lead.ownerOccupied) {
    factors.push("Owner-occupied — direct decision-maker on coverage");
  }
  const fit = lead.fitScore ?? lead.acsReceptivityScore;
  if (fit != null && fit >= 0.6) {
    factors.push("High household receptivity to insurance outreach");
  }
  return factors;
}

export function LeadSidePanel({
  lead,
  sessionId,
  orgId,
  userId,
  onClose,
  onPursueStart,
  onPursueCaptured,
  onPursueEnd,
}: LeadSidePanelProps) {
  const [message, setMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [pursueLoading, setPursueLoading] = useState(false);
  const [resolvedOwner, setResolvedOwner] = useState<string | null>(null);
  const [contactRole, setContactRole] = useState<"owner" | "resident" | "unknown" | null>(
    null,
  );
  const [persona, setPersona] = useState<Persona | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentResult | null>(null);
  const [outreachResult, setOutreachResult] = useState<StartOutreachResult | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const personaGenerationRef = useRef(0);

  const generatePersona = useAction(api.persona.generatePersona);
  const sendChatMessage = useAction(api.persona.sendChatMessage);
  const startOutreach = useAction(api.outreachActions.startOutreach);
  const logTouchSent = useAction(api.outreachActions.logTouchSent);
  const clearChatHistory = useMutation(api.chat.clearChatHistory);

  const leadConvexId = lead?.convexId as Id<"leads"> | undefined;

  const leadDoc = useQuery(
    api.leads.getLead,
    leadConvexId ? { leadId: leadConvexId } : "skip",
  );

  const outreachRecord = useQuery(
    api.outreach.getOutreachForLead,
    leadConvexId && (sessionId || userId)
      ? { sessionId, userId, leadId: leadConvexId }
      : "skip",
  );

  const outreachConfig = useQuery(
    api.outreach.getOutreachConfig,
    userId && orgId ? { orgId, userId } : {},
  );

  const chatHistory = useQuery(
    api.chat.getChatHistory,
    leadConvexId && sessionId
      ? { sessionId, leadId: leadConvexId }
      : "skip",
  );

  useEffect(() => {
    setMessage("");
    setPersona(null);
    setEnrichment(null);
    setOutreachResult(null);
    setChatError(null);
    setResolvedOwner(lead?.ownerFullName ?? lead?.recordedOwnerFullName ?? null);
    setContactRole(lead?.ownerContactRole ?? (lead?.ownerOccupied ? "owner" : "resident"));
  }, [lead?.id, lead?.ownerFullName, lead?.ownerContactRole, lead?.ownerOccupied]);

  useEffect(() => {
    if (!leadDoc?.contactInfo || typeof leadDoc.contactInfo !== "object") return;
    const cached = leadDoc.contactInfo as EnrichmentResult;
    if (cached.owner && cached.contact && typeof cached.playbook === "string") {
      setEnrichment(cached);
    }
  }, [leadDoc?.contactInfo]);

  useEffect(() => {
    if (!leadConvexId || !sessionId) return;

    const generation = ++personaGenerationRef.current;
    let cancelled = false;
    setPersonaLoading(true);
    generatePersona({ sessionId, leadId: leadConvexId, userId })
      .then((result) => {
        if (!cancelled && generation === personaGenerationRef.current) {
          setPersona(result as Persona);
        }
      })
      .catch((err) => {
        if (!cancelled && generation === personaGenerationRef.current) {
          setChatError(err instanceof Error ? err.message : "Failed to load persona");
        }
      })
      .finally(() => {
        if (!cancelled && generation === personaGenerationRef.current) {
          setPersonaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [leadConvexId, sessionId, userId, lead?.ownerFullName, generatePersona]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chatHistory]);

  const handleSend = useCallback(async () => {
    if (!leadConvexId || !message.trim()) return;
    setChatLoading(true);
    setChatError(null);
    try {
      await sendChatMessage({
        sessionId,
        leadId: leadConvexId,
        message: message.trim(),
        userId,
      });
      setMessage("");
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatLoading(false);
    }
  }, [leadConvexId, message, sendChatMessage, sessionId, userId]);

  const handlePursue = useCallback(async () => {
    if (!leadConvexId || !sessionId || !lead) return;
    setPursueLoading(true);
    onPursueStart?.(lead.id);
    setChatError(null);
    try {
      const result = (await startOutreach({
        sessionId,
        leadId: leadConvexId,
        orgId,
        userId,
        forceEnrichment: Boolean(outreachRecord || outreachResult),
      })) as StartOutreachResult;
      setOutreachResult(result);
      setEnrichment(result.enrichment);
      setResolvedOwner(result.enrichment.owner.fullName);
      setContactRole(
        result.enrichment.owner.contactRole ?? (lead?.ownerOccupied ? "owner" : "resident"),
      );
      onPursueCaptured?.(lead.id);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Pursue failed");
    } finally {
      setPursueLoading(false);
      onPursueEnd?.();
    }
  }, [
    lead,
    leadConvexId,
    sessionId,
    orgId,
    userId,
    startOutreach,
    outreachRecord,
    outreachResult,
    onPursueStart,
    onPursueCaptured,
    onPursueEnd,
  ]);

  const handleLogTouch = useCallback(
    async (touch: "touch1" | "touch2", channel?: OutreachChannel) => {
      if (!leadConvexId || !sessionId) return;
      await logTouchSent({ sessionId, leadId: leadConvexId, touch, channel });
    },
    [leadConvexId, sessionId, logTouchSent],
  );

  if (!lead) return null;

  const tier = getMatchTier(lead.matchScore);
  const barColor = getTierColor(tier);

  const personaParagraphList = personaParagraphs(persona);
  const coldApproach = personaColdApproach(persona);
  const objections = personaObjections(persona);
  const contact = enrichment?.contact;
  const parcelLabel =
    enrichment?.assessorParcel?.parcelNumber ??
    lead.parcelNumber ??
    (lead.assessorBlock && lead.assessorLot
      ? `${lead.assessorBlock}-${lead.assessorLot}`
      : null);

  return (
    <>
      <button
        type="button"
        className="fixed inset-x-0 bottom-0 top-[var(--quest-header-height)] z-30 bg-black/20 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none"
        onClick={onClose}
        aria-label="Close panel"
      />
      <aside
        className="western-detail-panel fixed right-0 top-[var(--quest-header-height)] z-40 flex h-[calc(100dvh-var(--quest-header-height))] w-full max-w-md flex-col animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-labelledby="lead-panel-title"
      >
        <div className="western-detail-header flex items-center justify-between px-5 py-4">
          <div>
            <p className="western-detail-label">Bounty details</p>
            <h2 id="lead-panel-title" className="western-title text-lg normal-case">
              {lead.address}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="western-close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <section className="western-detail-section">
            <div className="mb-3 flex items-center justify-between">
              <span className="western-label">Match score</span>
              <span className="text-sm font-bold" style={{ color: barColor }}>
                {lead.matchScore}/100
              </span>
            </div>
            {(() => {
              const fitScore = lead.fitScore ?? lead.acsReceptivityScore;
              const hasComponents = lead.needScore != null || lead.timingScore != null || fitScore != null;
              if (!hasComponents) {
                return (
                  <div className="western-score-track h-4 overflow-hidden">
                    <div
                      className="western-score-fill h-full"
                      style={{ width: `${lead.matchScore}%`, backgroundColor: barColor }}
                    />
                  </div>
                );
              }
              return (
                <>
                  <div className="western-score-track flex h-4 overflow-hidden">
                    {lead.needScore != null && (
                      <div className="h-full bg-red-400" style={{ width: `${lead.needScore * 45}%` }} />
                    )}
                    {lead.timingScore != null && (
                      <div className="h-full bg-amber-400" style={{ width: `${lead.timingScore * 30}%` }} />
                    )}
                    {fitScore != null && (
                      <div className="h-full bg-emerald-400" style={{ width: `${fitScore * 25}%` }} />
                    )}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs">
                    {lead.needScore != null && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-sm bg-red-400" />
                        <span className="text-amber-900/70">Risk</span>
                        <span className="font-semibold text-amber-950">
                          {Math.round(lead.needScore * 45)}
                          <span className="font-normal text-amber-900/50">/45</span>
                        </span>
                      </span>
                    )}
                    {lead.timingScore != null && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-sm bg-amber-400" />
                        <span className="text-amber-900/70">Timing</span>
                        <span className="font-semibold text-amber-950">
                          {Math.round(lead.timingScore * 30)}
                          <span className="font-normal text-amber-900/50">/30</span>
                        </span>
                      </span>
                    )}
                    {fitScore != null && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" />
                        <span className="text-amber-900/70">Fit</span>
                        <span className="font-semibold text-amber-950">
                          {Math.round(fitScore * 25)}
                          <span className="font-normal text-amber-900/50">/25</span>
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {lead.needScore != null && (
                      <div className="rounded-lg border border-red-100 bg-red-50/60 p-2.5">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-red-700">Risk</p>
                        <p className="text-[11px] leading-relaxed text-red-900/80">{riskRationale(lead)}</p>
                      </div>
                    )}
                    {lead.timingScore != null && (
                      <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">Timing</p>
                        <p className="text-[11px] leading-relaxed text-amber-900/80">{timingRationale(lead)}</p>
                      </div>
                    )}
                    {fitScore != null && (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Fit</p>
                        <p className="text-[11px] leading-relaxed text-emerald-900/80">{fitRationale(lead)}</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            {lead.urgent && (
              <p className="mt-3 text-sm font-semibold text-purple-600">! High-priority outreach</p>
            )}
          </section>

          <section className="western-detail-section">
            <h3 className="western-label mb-3">
              Coverage signals
            </h3>
            <dl className="space-y-2 text-sm">
              {lead.replacementCostToday != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Rebuild cost today</dt>
                  <dd className="font-semibold">{formatCurrency(lead.replacementCostToday)}</dd>
                </div>
              )}
              {lead.coverageAnchor != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Likely coverage anchor</dt>
                  <dd className="font-semibold">{formatCurrency(lead.coverageAnchor)}</dd>
                </div>
              )}
              {lead.replacementCostGapDollars != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Coverage gap</dt>
                  <dd className="font-semibold text-red-700">
                    {formatCurrency(lead.replacementCostGapDollars)}
                    {lead.replacementCostGapPct != null &&
                      ` (${Math.round(lead.replacementCostGapPct * 100)}%)`}
                  </dd>
                </div>
              )}
              {lead.sqft != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Sq ft</dt>
                  <dd className="font-semibold">{lead.sqft.toLocaleString()}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-amber-900/70">Home age</dt>
                <dd className="font-semibold">{lead.homeAgeYears} years</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-amber-900/70">Owner status</dt>
                <dd className="font-semibold">
                  {lead.ownerOccupied ? "Owner-occupied" : "Renter / unknown"}
                </dd>
              </div>
              {lead.yearsOwned != null && lead.purchaseYear != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Tenure</dt>
                  <dd className="font-semibold">
                    Since {lead.purchaseYear} ({lead.yearsOwned} yrs)
                  </dd>
                </div>
              )}
              {lead.timingConfidence && (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Timing confidence</dt>
                  <dd className="font-semibold capitalize">{lead.timingConfidence}</dd>
                </div>
              )}
              {lead.neighborhood && (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Neighborhood</dt>
                  <dd className="font-semibold">{lead.neighborhood}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="western-detail-section">
            <h3 className="western-label mb-2">
              Household profile
            </h3>
            {(() => {
              const priority = priorityLabel(lead.matchScore);
              const factors = priorityFactors(lead);
              return (
                <div className={`mb-3 rounded-lg border ${priority.border} ${priority.bg} px-3 py-2.5`}>
                  <p className={`text-xs font-bold uppercase tracking-wide ${priority.color}`}>
                    {priority.label}
                  </p>
                  {factors.length > 0 && (
                    <ul className={`mt-1.5 space-y-1 text-[11px] ${priority.color} opacity-90`}>
                      {factors.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}
            <p className="text-sm font-semibold text-amber-950">{lead.cluster}</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-900/85">
              {lead.clusterNarrative ??
                "Profile based on census-style behavioral cluster assignment for this household."}
            </p>
            {personaLoading && (
              <p className="mt-3 text-xs text-amber-800/60">Generating persona from property data…</p>
            )}
            {!personaLoading &&
              personaParagraphList.length === 0 &&
              !coldApproach && (
                <p className="mt-3 text-sm leading-relaxed text-amber-900/70">
                  Persona loads from coverage gap, tenure, and timing signals — not a one-size
                  template.
                </p>
              )}
            {personaParagraphList.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="mt-3 text-sm leading-relaxed text-amber-900/90"
              >
                {paragraph}
              </p>
            ))}
            {coldApproach && (
              <div className="mt-3 border-t border-amber-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/60">
                  If you reach out today
                </p>
                <p className="mt-2 text-sm leading-relaxed text-amber-900/90">{coldApproach}</p>
              </div>
            )}
            {objections.length > 0 && (
              <div className="mt-3 border-t border-amber-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/60">
                  Likely objections
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-900/80">
                  {objections.slice(0, 4).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {(persona?.preferred_contact_channel || persona?.preferred_contractor_channel) && (
              <p className="mt-3 text-xs text-amber-800/70">
                Preferred channel:{" "}
                <span className="font-semibold text-amber-950">
                  {asDisplayText(
                    persona.preferred_contact_channel ?? persona.preferred_contractor_channel,
                  )}
                </span>
              </p>
            )}
          </section>

          <section className="western-detail-section">
            <h3 className="western-label mb-3">
              Persona chat
            </h3>
            <div
              ref={scrollRef}
              className="western-chat-box mb-3 max-h-48 space-y-2 overflow-y-auto"
            >
              {chatHistory === undefined && (
                <p className="text-xs text-amber-800/60">Loading chat…</p>
              )}
              {chatHistory?.length === 0 && (
                <p className="text-xs text-amber-800/60">
                  Ask how this household might respond to your pitch.
                </p>
              )}
              {chatHistory?.map((turn, i) => (
                <div
                  key={`${turn.role}-${i}`}
                  className={`text-xs leading-relaxed ${
                    turn.role === "user"
                      ? "ml-4 text-right text-amber-950"
                      : "mr-4 text-amber-900"
                  }`}
                >
                  <span className="font-semibold">
                    {turn.role === "user" ? "You" : contactRole === "resident" ? "Resident" : "Homeowner"}:
                  </span>{" "}
                  {turn.content}
                </div>
              ))}
            </div>
            {chatError && (
              <p className="mb-2 text-xs text-red-700">{chatError}</p>
            )}
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="What coverage concerns might they raise?"
                className="western-input flex-1"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={chatLoading || !message.trim()}
                className="western-btn western-btn-primary px-3 py-2 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </section>
        </div>

        {OUTREACH_ENABLED && (
        <div className="western-detail-footer p-5 space-y-3">
          <button
            type="button"
            onClick={() => void handlePursue()}
            disabled={pursueLoading}
            className="western-btn western-btn-primary w-full py-3 disabled:opacity-60"
          >
            {pursueLoading ? "Lassoing into CRM…" : outreachRecord || outreachResult
                ? "Re-pursue lead"
                : "Pursue lead"}
          </button>

          {(enrichment || outreachResult) && contact && (
            <div className="western-card space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/60">
                  Contact
                </p>
                <p className="mt-1 font-semibold">{resolvedOwner ?? enrichment?.owner.fullName}</p>
                {lead.recordedOwnerFullName && (
                  <p className="mt-1 text-[10px] font-medium text-green-800">
                    Assessor-recorded owner
                  </p>
                )}
                {enrichment?.owner.source === "datasf_parcel_only" && (
                  <p className="mt-1 text-[10px] text-amber-800/70">
                    DataSF has parcel data only — no owner names online (CA law). Orange Slice sheet
                    will run contact waterfall; load assessor roll for real names.
                  </p>
                )}
              </div>
              {parcelLabel && (
                <p className="text-[10px] text-amber-800/70">Parcel {parcelLabel}</p>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/60">
                  Channels
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(["email", "phone", "linkedin", "mail", "d2d"] as OutreachChannel[]).map(
                    (ch) => (
                      <span
                        key={ch}
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          contact.channels.includes(ch)
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-400 line-through"
                        }`}
                      >
                        {CHANNEL_LABELS[ch]}
                      </span>
                    ),
                  )}
                </div>
              </div>
              {contact.emails.length > 0 && (
                <div>
                  <p className="text-xs text-amber-800/70">Verified email</p>
                  {contact.emails.map((e) => (
                    <p key={e} className="font-medium">{e}</p>
                  ))}
                </div>
              )}
              {contact.emails.length === 0 && contact.phones.length === 0 && !contact.linkedinUrl && (
                <p className="text-xs text-amber-800/70">
                  No verified email or phone yet — outreach will use door knock / mail, or re-pursue
                  after assessor owner names are loaded.
                </p>
              )}
              {contact.phones.length > 0 && (
                <div>
                  <p className="text-xs text-amber-800/70">Phone</p>
                  {contact.phones.map((p) => (
                    <p key={p} className="font-medium">{p}</p>
                  ))}
                </div>
              )}
              {enrichment?.playbook && (
                <p className="text-xs leading-relaxed text-amber-900/85">{enrichment.playbook}</p>
              )}
            </div>
          )}

          {(outreachRecord || outreachResult) && (
            <div className="western-card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-green-800">
                  {OUTREACH_STATUS_LABELS[
                    outreachResult?.status ?? outreachRecord?.status ?? "queued"
                  ] ?? "Queued"}
                </p>
                {(outreachConfig?.sheetUrl ||
                  process.env.NEXT_PUBLIC_ORANGE_SLICE_SHEET_URL) && (
                  <a
                    href={
                      outreachConfig?.sheetUrl ??
                      process.env.NEXT_PUBLIC_ORANGE_SLICE_SHEET_URL
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-semibold text-blue-700 hover:underline"
                  >
                    Open Orange Slice sheet
                  </a>
                )}
              </div>

              <div className="rounded-md bg-amber-50/80 p-2.5 text-[10px] leading-relaxed text-amber-950">
                <p className="font-bold uppercase tracking-wide text-amber-800/80">
                  Next in Orange Slice
                </p>
                {outreachConfig?.sheetWebhookConfigured ? (
                  <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                    <li>Row auto-pushed to sheet on Pursue</li>
                    <li>
                      Run <strong>Find contact</strong> then <strong>Send touch 1</strong>
                    </li>
                    <li>Status syncs back when Gmail sends</li>
                  </ol>
                ) : (
                  <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                    <li>
                      In Orange Slice: add <strong>Import from webhook</strong>, copy the webhook URL
                    </li>
                    <li>
                      Run{" "}
                      <code className="rounded bg-white px-1">
                        ./scripts/configure-orangeslice-autopush.sh &lt;url&gt;
                      </code>
                    </li>
                    <li>Re-pursue — rows will auto-push</li>
                  </ol>
                )}
              </div>

              {outreachResult?.touch1 && (
                <div className="border-t border-amber-100 pt-2 space-y-2">
                  <p className="text-[10px] font-semibold uppercase text-amber-800/60">
                    Touch 1 ready
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {outreachResult.touch1.mailto && (
                      <a
                        href={outreachResult.touch1.mailto}
                        onClick={() => void handleLogTouch("touch1", "email")}
                        className="western-btn western-btn-primary px-3 py-2"
                      >
                        Send email
                      </a>
                    )}
                    {contact?.phones[0] && (
                      <a
                        href={`tel:${contact.phones[0].replace(/[^\d+]/g, "")}`}
                        className="western-btn western-btn-ghost px-3 py-2"
                      >
                        Call
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </aside>
    </>
  );
}
