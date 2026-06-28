export function BoardLegend() {
  return (
    <div className="hidden shrink-0 items-center gap-1.5 md:flex">
      <span className="game-stat-chip game-stat-hot" title="Hot lead (70+)">
        <span className="game-stat-dot bg-green-500" />
        70+
      </span>
      <span className="game-stat-chip game-stat-warm" title="Warm (40–69)">
        <span className="game-stat-dot bg-yellow-500" />
        40–69
      </span>
      <span className="game-stat-chip game-stat-cold" title="Cold (&lt;40)">
        <span className="game-stat-dot bg-red-500" />
        &lt;40
      </span>
      <span className="game-stat-chip game-stat-urgent" title="High priority">
        <span className="game-stat-badge">!</span>
        Priority
      </span>
    </div>
  );
}
