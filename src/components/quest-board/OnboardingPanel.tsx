"use client";

import { useCallback, useState } from "react";
import { useAction } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { getSessionId } from "@/lib/session";
import type { Agent, AgentProfile } from "@/types/lead";

type OnboardingPanelProps = {
  onComplete: (agent: Agent) => void;
  userId?: string;
  orgId?: string;
};

export function OnboardingPanel({ onComplete, userId, orgId }: OnboardingPanelProps) {
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
          userId,
          orgId: orgId as Id<"organizations"> | undefined,
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
    [name, businessDescription, businessAddress, completeOnboarding, onComplete, userId, orgId],
  );

  return (
    <aside className="western-panel absolute left-4 top-4 z-30 w-full max-w-sm overflow-visible p-5">
      <div className="western-panel-header">
        <h2 className="western-title text-base">Agent setup</h2>
        <p className="western-body mt-1">
          Your office address centers the map. Leads are ranked by need and timing — not distance.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="western-label">Your name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="western-input mt-1"
            placeholder="Alex Chen"
          />
        </label>

        <label className="block">
          <span className="western-label">Agency description</span>
          <textarea
            required
            rows={3}
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            className="western-textarea mt-1"
            placeholder="Independent home insurance advisor in SF, focused on owner-occupied SFR…"
          />
        </label>

        <label className="relative z-50 block">
          <span className="western-label">Office address (San Francisco)</span>
          <AddressAutocomplete
            value={businessAddress}
            onChange={setBusinessAddress}
            placeholder="Start typing your address…"
          />
        </label>

        {error && <p className="western-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="western-btn western-btn-primary w-full py-2.5 disabled:opacity-60"
        >
          {loading ? "Loading map…" : "Continue"}
        </button>
      </form>
    </aside>
  );
}
