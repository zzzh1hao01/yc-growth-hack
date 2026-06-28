"use client";

import { useCallback, useState } from "react";

import type { Agent } from "@/types/lead";
import { buildDemoAgent } from "@/data/demoSample";

type OnboardingPanelDemoProps = {
  onComplete: (agent: Agent) => void;
};

export function OnboardingPanelDemo({ onComplete }: OnboardingPanelDemoProps) {
  const [name, setName] = useState("Alex Chen");
  const [businessDescription, setBusinessDescription] = useState(
    "Independent home insurance advisor in SF — coverage gap reviews for owner-occupied homes.",
  );
  const [businessAddress, setBusinessAddress] = useState("100 Market St, San Francisco, CA");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onComplete(buildDemoAgent(name, businessDescription, businessAddress));
    },
    [name, businessDescription, businessAddress, onComplete],
  );

  const handleSkip = useCallback(() => {
    onComplete(buildDemoAgent(name, businessDescription, businessAddress));
  }, [name, businessDescription, businessAddress, onComplete]);

  return (
    <aside className="game-panel absolute left-4 top-4 z-30 w-full max-w-sm overflow-visible p-5">
      <p className="game-quest-label">UI demo</p>
      <h2 className="game-title text-lg">Agent setup</h2>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/70">
        Sample mode — no backend. All leads, personas, and chat are mocked locally.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block text-xs font-semibold text-amber-900">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500"
          />
        </label>

        <label className="block text-xs font-semibold text-amber-900">
          Agency description
          <textarea
            rows={2}
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500"
          />
        </label>

        <label className="block text-xs font-semibold text-amber-900">
          Office address
          <input
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500"
          />
        </label>

        <button type="submit" className="game-btn game-btn-primary w-full py-2.5 text-sm">
          Start quest →
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="game-btn game-btn-ghost w-full py-2 text-xs"
        >
          Skip — load demo board instantly
        </button>
      </form>
    </aside>
  );
}
