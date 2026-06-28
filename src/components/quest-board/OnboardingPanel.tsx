"use client";

import { useCallback, useState } from "react";
import { useAction } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { getSessionId } from "@/lib/session";
import type { CompanyContext, Contractor, ServiceProfile } from "@/types/lead";

type OnboardingPanelProps = {
  onComplete: (contractor: Contractor) => void;
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
      setLoading(true);

      try {
        const sessionId = getSessionId();
        const result = await completeOnboarding({
          sessionId,
          name: name.trim(),
          businessDescription: businessDescription.trim(),
          businessAddress: businessAddress.trim(),
        });

        onComplete({
          name: name.trim(),
          businessDescription: businessDescription.trim(),
          businessAddress: result.businessAddress,
          lat: result.lat,
          lng: result.lng,
          serviceProfile: result.serviceProfile as ServiceProfile,
          companyContext: (result.companyContext as CompanyContext) ?? undefined,
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
    <aside className="absolute left-4 top-4 z-20 w-full max-w-sm rounded-2xl border border-amber-300/70 bg-[#fff9f0]/95 p-5 shadow-xl backdrop-blur-sm">
      <h2 className="text-lg font-bold text-amber-950">Contractor setup</h2>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/70">
        Tell us about your business. Fiber AI enriches your company profile, contact
        channels, and key people from your address and description. This can take up
        to a minute. Pick your business from Google autocomplete when you can.
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
          Business description
          <textarea
            required
            rows={3}
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500"
            placeholder="HVAC install and repair in the Sunset, mostly older single-family homes…"
          />
        </label>

        <label className="block text-xs font-semibold text-amber-900">
          Business address (San Francisco)
          <AddressAutocomplete
            required
            value={businessAddress}
            onChange={setBusinessAddress}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500"
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
          {loading ? "Enriching with Fiber AI…" : "Start bounty board"}
        </button>
      </form>
    </aside>
  );
}
