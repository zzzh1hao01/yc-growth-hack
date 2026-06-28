"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { EnrichmentResult, Lead, OutreachChannel, Persona, StartOutreachResult } from "@/types/lead";
import { OUTREACH_ENABLED } from "@/types/lead";
import { asDisplayText, personaColdApproach, personaObjections, personaParagraphs } from "@/lib/safe-text";
import { getNearestLandmark } from "@/lib/nearest-landmark";
import { getMatchTier, getTierColor, getTierLabel } from "@/lib/lead-utils";

type LeadSidePanelProps = {
  lead: Lead | null;
  sessionId: string;
  orgId?: Id<"organizations">;
  userId?: string;
  onClose: () => void;
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

export function LeadSidePanel({ lead, sessionId, orgId, userId, onClose }: LeadSidePanelProps) {
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
    if (!leadConvexId || !sessionId) return;
    setPursueLoading(true);
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
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Pursue failed");
    } finally {
      setPursueLoading(false);
    }
  }, [leadConvexId, sessionId, orgId, userId, startOutreach, outreachRecord, outreachResult, lead?.ownerOccupied]);

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
  const qualityLabel = getTierLabel(tier);
  const nearestLandmark = getNearestLandmark(lead.lat, lead.lng);
  const locationLabel = lead.neighborhood
    ? `${lead.neighborhood} · near ${nearestLandmark}`
    : `Near ${nearestLandmark}`;

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
        className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none"
        onClick={onClose}
        aria-label="Close panel"
      />
      <aside
        className="western-detail-panel fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col"
        role="dialog"
        aria-labelledby="lead-panel-title"
      >
        <div className="western-detail-header flex items-center justify-between px-4 py-3">
          <div>
            <p className="western-detail-label">Lead details</p>
            <h2 id="lead-panel-title" className="western-title text-lg">
              {locationLabel}
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
              <span className="western-label text-sm normal-case tracking-normal">Contact quality</span>
              <span className="text-sm font-bold" style={{ color: barColor }}>
                {qualityLabel} · {lead.matchScore}/100
              </span>
            </div>
            {lead.needScore != null || lead.timingScore != null || lead.acsReceptivityScore != null ? (
              <>
                <div className="western-score-track flex h-4 overflow-hidden">
                  {lead.needScore != null && (
                    <div className="h-full bg-red-400" style={{ width: `${lead.needScore * 45}%` }} />
                  )}
                  {lead.timingScore != null && (
                    <div className="h-full bg-amber-400" style={{ width: `${lead.timingScore * 30}%` }} />
                  )}
                  {lead.acsReceptivityScore != null && (
                    <div className="h-full bg-emerald-400" style={{ width: `${lead.acsReceptivityScore * 25}%` }} />
                  )}
                </div>
                <div className="mt-2 flex gap-4 text-xs">
                  {lead.needScore != null && (
                    <span className="flex items-center gap-1.5">
                      <span className="western-score-legend-dot bg-red-400" />
                      <span className="text-amber-900/70">Risk</span>
                      <span className="font-semibold text-amber-950">{Math.round(lead.needScore * 100)}</span>
                    </span>
                  )}
                  {lead.timingScore != null && (
                    <span className="flex items-center gap-1.5">
                      <span className="western-score-legend-dot bg-amber-400" />
                      <span className="text-amber-900/70">Timing</span>
                      <span className="font-semibold text-amber-950">{Math.round(lead.timingScore * 100)}</span>
                    </span>
                  )}
                  {lead.acsReceptivityScore != null && (
                    <span className="flex items-center gap-1.5">
                      <span className="western-score-legend-dot bg-emerald-400" />
                      <span className="text-amber-900/70">Fit</span>
                      <span className="font-semibold text-amber-950">{Math.round(lead.acsReceptivityScore * 100)}</span>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="western-score-track">
                <div
                  className="western-score-fill"
                  style={{ width: `${lead.matchScore}%`, backgroundColor: barColor }}
                />
              </div>
            )}
            {lead.urgent && (
              <p className="mt-3 text-sm font-semibold text-red-600">High-priority outreach</p>
            )}
            {lead.scoreReasons && lead.scoreReasons.length > 0 && (
              <div className="mt-3">
                <p className="western-label mt-3 normal-case tracking-normal">
                  Why this rating
                </p>
                <ul className="mt-1 space-y-1 text-xs text-amber-900/80">
                  {lead.scoreReasons.slice(0, 4).map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="western-detail-section">
            <h3 className="western-detail-label mb-3">Coverage signals</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-amber-900/70">Contact score</dt>
                <dd className="font-semibold">{lead.matchScore}/100</dd>
              </div>
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
              <div className="flex justify-between gap-4">
                <dt className="text-amber-900/70">Nearest landmark</dt>
                <dd className="font-semibold text-right">{nearestLandmark}</dd>
              </div>
            </dl>
          </section>

          <section className="western-detail-section">
            <h3 className="western-detail-label mb-2">Household</h3>
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
            <h3 className="western-detail-label mb-3">Persona chat</h3>
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
                className="western-btn western-btn-primary western-btn-sm px-3 py-2 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </section>
        </div>

        {OUTREACH_ENABLED && (
        <div className="western-detail-footer border-t border-amber-200/60 p-5 space-y-3">
          <button
            type="button"
            onClick={() => void handlePursue()}
            disabled={pursueLoading}
            className="western-btn western-btn-primary w-full py-3.5 text-sm disabled:opacity-60"
          >
            {pursueLoading
              ? "Looking up contact…"
              : outreachRecord || outreachResult
                ? "Reach out again"
                : "Reach out"}
          </button>

          {(enrichment || outreachResult) && contact && (
            <div className="western-card space-y-3 text-sm text-amber-950">
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
                  <p className="text-xs text-amber-800/70">Email</p>
                  {contact.emails.map((e) => (
                    <p key={e} className="font-medium">{e}</p>
                  ))}
                </div>
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

              <div className="western-card p-2.5 text-[10px] leading-relaxed text-amber-950">
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
                      <code className="western-code">
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
                        className="western-btn western-btn-primary western-btn-sm"
                      >
                        Send email
                      </a>
                    )}
                    {contact?.phones[0] && (
                      <a
                        href={`tel:${contact.phones[0].replace(/[^\d+]/g, "")}`}
                        className="western-btn western-btn-ghost western-btn-sm"
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
