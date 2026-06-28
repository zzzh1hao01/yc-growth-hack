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
};

export function LeadFocusFilter({
  minScore,
  visibleCount,
  totalCount,
  onChange,
}: LeadFocusFilterProps) {
  const hidden = totalCount - visibleCount;

  return (
    <div
      className="western-hud-control flex min-w-[180px] max-w-xs flex-col gap-1 px-3 py-2"
      title="Raise the bar to hide lower-quality contacts from the map"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">
        <span>Focus leads</span>
        <span className="normal-case tracking-normal text-amber-950">
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
        className="h-1.5 w-full cursor-pointer accent-amber-700"
        aria-label="Minimum lead score to show on map"
      />
      <p className="text-[10px] leading-snug text-amber-900/75">
        {describeImportanceFilter(minScore)}
        {hidden > 0 ? ` · ${hidden} hidden` : ""}
      </p>
    </div>
  );
}
