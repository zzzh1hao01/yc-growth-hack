"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEMO_ENRICHMENT, getDemoChatReply, getDemoPersona } from "@/data/demoSample";
import type { Lead, Persona } from "@/types/lead";
import { personaColdApproach, personaObjections, personaParagraphs } from "@/lib/safe-text";

type LeadSidePanelDemoProps = {
  lead: Lead | null;
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

export function LeadSidePanelDemo({ lead, navVisible, onClose }: LeadSidePanelDemoProps) {
  const [message, setMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pursueLoading, setPursueLoading] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>(
    [],
  );
  const [pursued, setPursued] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lead) return;
    setMessage("");
    setChatHistory([]);
    setPursued(false);
    setPersona(getDemoPersona(lead.id));
  }, [lead?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chatHistory]);

  const handleSend = useCallback(() => {
    if (!message.trim()) return;
    const userMsg = message.trim();
    setMessage("");
    setChatHistory((h) => [...h, { role: "user", content: userMsg }]);
    setChatLoading(true);
    window.setTimeout(() => {
      setChatHistory((h) => [
        ...h,
        { role: "assistant", content: getDemoChatReply(userMsg) },
      ]);
      setChatLoading(false);
    }, 600);
  }, [message]);

  const handlePursue = useCallback(() => {
    setPursueLoading(true);
    window.setTimeout(() => {
      setPursued(true);
      setPursueLoading(false);
    }, 800);
  }, []);

  if (!lead) return null;

  const tier = lead.matchScore >= 70 ? "hot" : lead.matchScore >= 40 ? "warm" : "cold";
  const barColor = tier === "hot" ? "#22c55e" : tier === "warm" ? "#eab308" : "#ef4444";
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
        className={`game-quest-panel fixed right-0 z-40 flex w-full max-w-md flex-col transition-[top,height] duration-200 ${panelTopClass}`}
        role="dialog"
        aria-labelledby="lead-panel-title-demo"
      >
        <div className="game-quest-header flex shrink-0 items-center justify-between px-4 py-3">
          <div>
            <p className="game-quest-label">Quest log · demo</p>
            <h2 id="lead-panel-title-demo" className="game-title text-lg">
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <section className="game-quest-section">
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
              <p className="mt-3 text-sm font-semibold text-red-600">! High-priority outreach</p>
            )}
            {lead.needScore != null && lead.timingScore != null && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                  <span className="text-amber-800/70">Need</span>
                  <p className="font-bold text-amber-950">{Math.round(lead.needScore * 100)}/100</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                  <span className="text-amber-800/70">Timing</span>
                  <p className="font-bold text-amber-950">{Math.round(lead.timingScore * 100)}/100</p>
                </div>
              </div>
            )}
            {lead.scoreReasons && lead.scoreReasons.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-amber-900/80">
                {lead.scoreReasons.slice(0, 4).map((reason) => (
                  <li key={reason}>• {reason}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="game-quest-section">
            <h3 className="game-quest-label mb-3">Coverage Signals</h3>
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
            </dl>
          </section>

          <section className="game-quest-section">
            <h3 className="game-quest-label mb-2">Household Profile</h3>
            <p className="text-sm font-semibold text-amber-950">{lead.cluster}</p>
            {lead.clusterNarrative && (
              <p className="mt-2 text-sm leading-relaxed text-amber-900/85">{lead.clusterNarrative}</p>
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
                <p className="game-quest-label">If you reach out today</p>
                <p className="mt-2 text-sm leading-relaxed text-amber-900/90">{coldApproach}</p>
              </div>
            )}
            {objections.length > 0 && (
              <div className="mt-3 border-t border-amber-100 pt-3">
                <p className="game-quest-label">Likely objections</p>
                <ul className="mt-2 space-y-1 text-xs text-amber-900/80">
                  {objections.slice(0, 4).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="game-quest-section">
            <h3 className="game-quest-label mb-3">Persona Chat</h3>
            <div
              ref={scrollRef}
              className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-amber-50/80 p-3"
            >
              {chatHistory.length === 0 && (
                <p className="text-xs text-amber-800/60">
                  Ask how this household might respond to your pitch. (Demo replies)
                </p>
              )}
              {chatHistory.map((turn, i) => (
                <div
                  key={`${turn.role}-${i}`}
                  className={`text-xs leading-relaxed ${
                    turn.role === "user" ? "ml-4 text-right text-amber-950" : "mr-4 text-amber-900"
                  }`}
                >
                  <span className="font-semibold">
                    {turn.role === "user" ? "You" : "Homeowner"}:
                  </span>{" "}
                  {turn.content}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="What coverage concerns might they raise?"
                className="flex-1 rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={chatLoading || !message.trim()}
                className="game-btn game-btn-primary px-3 py-2 text-xs disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </section>
        </div>

        <div className="game-quest-footer border-t border-amber-200/60 p-5 space-y-3">
          <button
            type="button"
            onClick={handlePursue}
            disabled={pursueLoading}
            className="game-btn game-btn-primary w-full py-3.5 text-sm disabled:opacity-60"
          >
            {pursueLoading ? "Pursuing… (demo)" : pursued ? "Re-pursue lead (demo)" : "Pursue lead (demo)"}
          </button>
          {pursued && (
            <div className="rounded-lg bg-white p-3 text-sm text-amber-950 space-y-2">
              <p className="game-quest-label">Sample contact</p>
              <p className="font-semibold">{lead.ownerFullName ?? DEMO_ENRICHMENT.contact.name}</p>
              <p>{DEMO_ENRICHMENT.contact.phone}</p>
              <p>{DEMO_ENRICHMENT.contact.email}</p>
              <p className="text-xs leading-relaxed text-amber-900/85">{DEMO_ENRICHMENT.playbook}</p>
              <p className="text-[10px] text-amber-800/60">Demo data — no Orange Slice call</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
