"use client";

import { useCallback, useState } from "react";
import { useAction } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { getSessionId } from "@/lib/session";
import type { Agent, AgentProfile } from "@/types/lead";

type OnboardingPanelProps = {
  onComplete: (agent: Agent) => void;
};

export function OnboardingPanel({ onComplete }: OnboardingPanelProps) {
  const completeOnboarding = useAction(api.onboarding.completeOnboarding);
  const [name, setName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedAddress = businessAddress.trim();
      if (!trimmedAddress) {
        setError("Enter your office address in San Francisco.");
        return;
      }

      setLoading(true);

      try {
        const sessionId = getSessionId();
        const result = await completeOnboarding({
          sessionId,
          name: name.trim(),
          businessDescription: businessDescription.trim(),
          businessAddress: trimmedAddress,
        });

        onComplete({
          name: name.trim(),
          businessDescription: businessDescription.trim(),
          businessAddress: result.businessAddress,
          lat: result.lat,
          lng: result.lng,
          serviceProfile: result.serviceProfile as AgentProfile,
          companyEnrichmentStatus: result.companyEnrichmentStatus,
          businessName: result.businessName as string | undefined,
          serviceRegionLabel: result.serviceRegionLabel as string | undefined,
          serviceRegionIds: result.serviceRegionIds as string[] | undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Onboarding failed");
      } finally {
        setLoading(false);
      }
    },
    [name, businessDescription, businessAddress, completeOnboarding, onComplete],
  );

  return (
    <aside className="absolute left-4 top-4 z-30 w-full max-w-sm overflow-visible rounded-2xl border border-amber-300/70 bg-[#fff9f0]/95 p-5 shadow-xl backdrop-blur-sm">
      <h2 className="text-lg font-bold text-amber-950">Agent setup</h2>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/70">
        Your office address centers the map. Leads are ranked by need and timing scores — not
        distance from your office.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block text-xs font-semibold text-amber-900">
          Your name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500"
            placeholder="Alex Chen"
          />
        </label>

        <label className="block text-xs font-semibold text-amber-900">
          Agency description
          <textarea
            required
            rows={3}
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500"
            placeholder="Independent home insurance advisor in SF, focused on owner-occupied SFR and coverage reviews…"
          />
        </label>

        <label className="relative z-50 block text-xs font-semibold text-amber-900">
          Office address (San Francisco)
          <AddressAutocomplete
            value={businessAddress}
            onChange={setBusinessAddress}
            placeholder="Start typing your address…"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-bold text-amber-50 transition hover:bg-amber-800 disabled:opacity-60"
        >
          {loading ? "Loading map…" : "Continue"}
        </button>
      </form>
    </aside>
  );
}
