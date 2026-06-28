"use client";

import {
  countLeadsByTier,
  getTierLabel,
  type TierVisibility,
} from "@/lib/lead-utils";
import type { Lead } from "@/types/lead";

type BoardLegendProps = {
  leads: Lead[];
  visibility: TierVisibility;
  onToggle: (tier: keyof TierVisibility) => void;
};

const TIER_CONFIG = [
  { key: "good" as const, matchTier: "hot" as const, color: "#22c55e", scoreLabel: "70+" },
  { key: "moderate" as const, matchTier: "warm" as const, color: "#eab308", scoreLabel: "40–69" },
  { key: "bad" as const, matchTier: "cold" as const, color: "#ef4444", scoreLabel: "<40" },
];

export function BoardLegend({ leads, visibility, onToggle }: BoardLegendProps) {
  const counts = countLeadsByTier(leads);

  return (
    <div className="flex shrink-0 items-center gap-1">
      {TIER_CONFIG.map(({ key, matchTier, color, scoreLabel }) => {
        const active = visibility[key];
        const count = counts[key];
        const label = getTierLabel(matchTier);

        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            className={`western-legend-chip ${active ? "western-legend-chip-active" : "western-legend-chip-inactive"}`}
            title={`${active ? "Hide" : "Show"} ${label} contacts (${scoreLabel})`}
            aria-pressed={active}
          >
            <span className="western-legend-dot" style={{ backgroundColor: color }} />
            <span>{label}</span>
            <span className="western-legend-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
