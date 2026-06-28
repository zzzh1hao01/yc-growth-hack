export function BoardLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-amber-950/80">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
        Hot lead (70+)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
        Warm (40–69)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
        Cold (&lt;40)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          !
        </span>
        High priority
      </span>
      <span className="text-amber-900/50">· ~400 pins · proportional sample</span>
    </div>
  );
}
