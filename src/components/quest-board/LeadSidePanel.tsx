"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ContactInfo, Lead, Persona } from "@/types/lead";
import { asDisplayText, personaColdApproach, personaObjections, personaParagraphs } from "@/lib/safe-text";

type LeadSidePanelProps = {
  lead: Lead | null;
  sessionId: string;
  navVisible: boolean;
  onClose: () => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LeadSidePanel({ lead, sessionId, navVisible, onClose }: LeadSidePanelProps) {
  const [message, setMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [resolvedOwner, setResolvedOwner] = useState<string | null>(null);
  const [contactRole, setContactRole] = useState<"owner" | "resident" | "unknown" | null>(
    null,
  );
  const [persona, setPersona] = useState<Persona | null>(null);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const personaGenerationRef = useRef(0);

  const generatePersona = useAction(api.persona.generatePersona);
  const sendChatMessage = useAction(api.persona.sendChatMessage);
  const enrichContact = useAction(api.enrichment.enrichContact);
  const lookupOwnerName = useAction(api.enrichment.lookupOwnerName);
  const clearChatHistory = useMutation(api.chat.clearChatHistory);

  const leadConvexId = lead?.convexId as Id<"leads"> | undefined;

  const chatHistory = useQuery(
    api.chat.getChatHistory,
    leadConvexId && sessionId
      ? { sessionId, leadId: leadConvexId }
      : "skip",
  );

  useEffect(() => {
    setMessage("");
    setPersona(null);
    setContactInfo(null);
    setChatError(null);
    setResolvedOwner(lead?.ownerFullName ?? null);
    setContactRole(lead?.ownerContactRole ?? (lead?.ownerOccupied ? "owner" : "resident"));
  }, [lead?.id, lead?.ownerFullName, lead?.ownerContactRole, lead?.ownerOccupied]);

  useEffect(() => {
    if (!leadConvexId || !sessionId) return;

    const generation = ++personaGenerationRef.current;
    let cancelled = false;
    setPersonaLoading(true);
    generatePersona({ sessionId, leadId: leadConvexId })
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
  }, [leadConvexId, sessionId, lead?.ownerFullName, generatePersona]);

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
      });
      setMessage("");
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatLoading(false);
    }
  }, [leadConvexId, message, sendChatMessage, sessionId]);

  const handleLookupOwner = useCallback(async () => {
    if (!leadConvexId || !sessionId) return;
    setOwnerLoading(true);
    setChatError(null);
    try {
      const owner = await lookupOwnerName({
        leadId: leadConvexId,
        force: Boolean(resolvedOwner),
      });
      setResolvedOwner(owner.fullName);
      setContactRole(owner.contactRole ?? (lead?.ownerOccupied ? "owner" : "resident"));
      setPersonaLoading(true);
      const generation = ++personaGenerationRef.current;
      const refreshed = await generatePersona({
        sessionId,
        leadId: leadConvexId,
        force: true,
      });
      if (generation === personaGenerationRef.current) {
        setPersona(refreshed as Persona);
        await clearChatHistory({ sessionId, leadId: leadConvexId });
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Owner lookup failed");
    } finally {
      setOwnerLoading(false);
      setPersonaLoading(false);
    }
  }, [leadConvexId, lookupOwnerName, generatePersona, clearChatHistory, sessionId, resolvedOwner, lead?.ownerOccupied]);

  const handleEnrich = useCallback(async () => {
    if (!leadConvexId) return;
    setContactLoading(true);
    setChatError(null);
    try {
      const info = (await enrichContact({
        sessionId,
        leadId: leadConvexId,
      })) as ContactInfo;
      setContactInfo(info);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setContactLoading(false);
    }
  }, [leadConvexId, enrichContact, sessionId]);

  if (!lead) return null;

  const tier =
    lead.matchScore >= 70 ? "hot" : lead.matchScore >= 40 ? "warm" : "cold";
  const barColor =
    tier === "hot" ? "#22c55e" : tier === "warm" ? "#eab308" : "#ef4444";

  const personaParagraphList = personaParagraphs(persona);
  const coldApproach = personaColdApproach(persona);
  const objections = personaObjections(persona);

  const panelTopClass = navVisible
    ? "top-[var(--quest-header-height)] h-[calc(100dvh-var(--quest-header-height))]"
    : "top-0 h-dvh";

  return (
    <>
      <button
        type="button"
        className={`fixed inset-x-0 bottom-0 z-30 bg-black/20 backdrop-blur-[1px] transition-[top] duration-200 md:bg-transparent md:backdrop-blur-none ${
          navVisible ? "top-[var(--quest-header-height)]" : "top-0"
        }`}
        onClick={onClose}
        aria-label="Close panel"
      />
      <aside
        className={`fixed right-0 z-40 flex w-full max-w-md flex-col border-l border-amber-200/60 bg-[#fff9f0] shadow-2xl transition-[top,height] duration-200 ${panelTopClass}`}
        role="dialog"
        aria-labelledby="lead-panel-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-amber-200/60 bg-[#f5e6c8] px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800/70">
              Bounty Details
            </p>
            <h2 id="lead-panel-title" className="text-lg font-bold text-amber-950">
              {lead.address}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-amber-900/60 hover:bg-amber-200/50"
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
                {lead.matchScore}/100
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${lead.matchScore}%`, backgroundColor: barColor }}
              />
            </div>
            {lead.urgent && (
              <p className="mt-3 text-sm font-semibold text-red-600">! Urgent lead</p>
            )}
            {lead.distanceMiles != null && (
              <p className="mt-2 text-xs text-amber-800/70">
                {lead.distanceMiles.toFixed(1)} mi from your business
              </p>
            )}
            {lead.scoreReasons && lead.scoreReasons.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-amber-900/80">
                {lead.scoreReasons.slice(0, 4).map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800/70">
              Property Signals
            </h3>
            <dl className="space-y-2 text-sm">
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
              {lead.assessedValue != null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-amber-900/70">Assessed value</dt>
                  <dd className="font-semibold">{formatCurrency(lead.assessedValue)}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-800/70">
              Household Cluster
            </h3>
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
                  Persona loads from cluster, assessed value, tenure, and permit urgency — not a
                  one-size template.
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
                  If you knock today
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
            {persona?.preferred_contractor_channel && (
              <p className="mt-3 text-xs text-amber-800/70">
                Preferred channel:{" "}
                <span className="font-semibold text-amber-950">
                  {asDisplayText(persona.preferred_contractor_channel)}
                </span>
              </p>
            )}
          </section>

          <section className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800/70">
              Persona Chat
            </h3>
            <div
              ref={scrollRef}
              className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-amber-50/80 p-3"
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
                placeholder="What objections might they have?"
                className="flex-1 rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={chatLoading || !message.trim()}
                className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </section>
        </div>

        <div className="border-t border-amber-200/60 bg-[#f5e6c8]/50 p-5 space-y-3">
          <div className="rounded-lg bg-white/80 p-3 text-sm text-amber-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/60">
              Contact at this address
            </p>
            {resolvedOwner ? (
              <div>
                <p className="mt-1 font-semibold">{resolvedOwner}</p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-800/70">
                  {contactRole === "resident"
                    ? "Likely resident · may not be title holder"
                    : contactRole === "owner"
                      ? "Likely homeowner"
                      : "Role unverified"}
                </p>
                <p className="mt-1 text-[10px] text-amber-800/60">
                  Persona and chat use this name. Re-lookup refreshes from web research.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-amber-800/70">
                {lead?.ownerOccupied === false
                  ? "This property looks like a rental — lookup finds who likely lives here, not necessarily the title holder."
                  : "Resolve the contact name before contact lookup (Exa + web search, then Orange Slice)."}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleLookupOwner()}
              disabled={ownerLoading}
              className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              {ownerLoading
                ? "Looking up…"
                : resolvedOwner
                  ? "Re-lookup contact"
                  : "Look up who lives here"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleEnrich()}
            disabled={contactLoading}
            className="w-full rounded-xl bg-amber-900 px-4 py-3 text-sm font-bold text-amber-50 hover:bg-amber-800 disabled:opacity-60"
          >
            {contactLoading ? "Looking up contact…" : "Get contact info"}
          </button>
          {contactInfo && (
            <div className="rounded-lg bg-white p-3 text-sm text-amber-950">
              <p className="font-semibold">{contactInfo.name}</p>
              <p>{contactInfo.phone}</p>
              <p>{contactInfo.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {contactInfo.phone && contactInfo.phone !== "Not found" && (
                  <a
                    href={`tel:${contactInfo.phone.replace(/[^\d+]/g, "")}`}
                    className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    Call
                  </a>
                )}
                {contactInfo.email && contactInfo.email !== "Not found" && (
                  <a
                    href={`mailto:${encodeURIComponent(contactInfo.email)}?subject=${encodeURIComponent(`Inquiry about ${lead.address}`)}`}
                    className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                  >
                    Email
                  </a>
                )}
              </div>
              <p className="mt-2 text-[10px] text-amber-800/60">
                Enriched via Orange Slice contact waterfall
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
