export function BoardLegend() {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="western-legend-chip western-legend-chip-active pointer-events-none">
        <span className="western-legend-dot" style={{ backgroundColor: "#4ade80" }} />
        Hot
      </span>
      <span className="western-legend-chip western-legend-chip-active pointer-events-none">
        <span className="western-legend-dot" style={{ backgroundColor: "#fbbf24" }} />
        Warm
      </span>
      <span className="western-legend-chip western-legend-chip-active pointer-events-none">
        <span className="western-legend-dot" style={{ backgroundColor: "#f87171" }} />
        Cold
      </span>
      <span className="western-legend-chip western-legend-chip-active pointer-events-none hidden sm:inline-flex">
        <span className="western-legend-dot" style={{ backgroundColor: "#a855f7" }} />
        Priority
      </span>
    </div>
  );
}
