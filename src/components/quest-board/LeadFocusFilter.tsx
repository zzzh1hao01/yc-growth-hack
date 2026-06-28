"use client";

import {
  COLD_SCORE_CEILING,
  describeImportanceFilter,
} from "@/lib/lead-utils";

type LeadFocusFilterProps = {
  minScore: number;
  visibleCount: number;
  totalCount: number;
  onChange: (minScore: number) => void;
  compact?: boolean;
};

export function LeadFocusFilter({
  minScore,
  visibleCount,
  totalCount,
  onChange,
  compact = false,
}: LeadFocusFilterProps) {
  const hidden = totalCount - visibleCount;

  if (compact) {
    return (
      <div
        className="western-hud-control flex items-center gap-2 px-2.5 py-1"
        title="Raise the bar to hide low-value cold leads from the map"
      >
        <span className="western-label shrink-0">Focus</span>
        <input
          type="range"
          min={0}
          max={COLD_SCORE_CEILING}
          step={1}
          value={minScore}
          onChange={(event) => onChange(Number(event.target.value))}
          className="western-range w-16 sm:w-24"
          aria-label="Minimum lead score to show on map"
        />
        <span className="western-label shrink-0 tabular-nums">
          {visibleCount}/{totalCount}
        </span>
      </div>
    );
  }

  return (
    <div
      className="western-hud-control flex min-w-[200px] max-w-xs flex-col gap-1.5 px-3 py-2"
      title="Raise the bar to hide low-value cold leads from the map"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="western-label">Focus leads</span>
        <span className="western-label tabular-nums normal-case">
          {visibleCount}
          {totalCount > 0 ? ` / ${totalCount}` : ""} pins
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={COLD_SCORE_CEILING}
        step={1}
        value={minScore}
        onChange={(event) => onChange(Number(event.target.value))}
        className="western-range"
        aria-label="Minimum lead score to show on map"
      />
      <p className="western-body text-[10px]">
        {describeImportanceFilter(minScore)}
        {hidden > 0 ? ` · ${hidden} hidden` : ""}
      </p>
    </div>
  );
}
