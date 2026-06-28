export function BoardLegend() {
  return (
    <div className="hidden shrink-0 items-center gap-2.5 text-[10px] font-semibold text-amber-950/80 md:flex">
      <span className="flex items-center gap-1" title="Hot lead (70+)">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
        70+
      </span>
      <span className="flex items-center gap-1" title="Warm (40–69)">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />
        40–69
      </span>
      <span className="flex items-center gap-1" title="Cold (&lt;40)">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
        &lt;40
      </span>
      <span className="flex items-center gap-1" title="Urgent opportunity">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
          !
        </span>
        Urgent
      </span>
    </div>
  );
}
