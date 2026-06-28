"use client";

import type { Lead } from "@/types/lead";
import { getMatchTier, getTierColor } from "@/lib/lead-utils";

type LeadSpriteProps = {
  lead: Lead;
  x: number;
  y: number;
  selected: boolean;
  onSelect: (lead: Lead) => void;
};

const SPRITE_SCALE = 0.62;

const VARIANT_STYLES = [
  { hair: "#5c3d2e", hat: null, skin: "#f5c9a8" },
  { hair: "#2d2d2d", hat: "#6366f1", skin: "#e8b896" },
  { hair: "#d97706", hat: "#059669", skin: "#f0c4a0" },
  { hair: "#7c3aed", hat: null, skin: "#d4a574" },
] as const;

function PixelCharacter({
  variant,
  bodyColor,
  waving,
}: {
  variant: Lead["spriteVariant"];
  bodyColor: string;
  waving: boolean;
}) {
  const style = VARIANT_STYLES[variant];

  return (
    <svg
      width="48"
      height="56"
      viewBox="0 0 48 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-sm"
    >
      <ellipse cx="24" cy="52" rx="10" ry="2.5" fill="rgba(0,0,0,0.12)" />
      <rect x="16" y="28" width="16" height="18" rx="2" fill={bodyColor} />
      <rect x="18" y="30" width="4" height="4" rx="1" fill="rgba(255,255,255,0.35)" />
      <rect x="10" y="30" width="6" height="12" rx="2" fill={bodyColor} />
      <g className={waving ? "sprite-wave-arm" : undefined}>
        <rect x="32" y="28" width="6" height="12" rx="2" fill={bodyColor} />
        <rect x="34" y="26" width="4" height="4" rx="1" fill={style.skin} />
      </g>
      <rect x="14" y="10" width="20" height="18" rx="3" fill={style.skin} />
      {style.hat ? (
        <>
          <rect x="12" y="6" width="24" height="8" rx="2" fill={style.hat} />
          <rect x="10" y="12" width="28" height="4" rx="1" fill={style.hat} opacity="0.8" />
        </>
      ) : (
        <>
          <rect x="14" y="8" width="20" height="8" rx="2" fill={style.hair} />
          <rect x="12" y="12" width="6" height="10" rx="2" fill={style.hair} />
          <rect x="30" y="12" width="6" height="10" rx="2" fill={style.hair} />
        </>
      )}
      <rect x="18" y="18" width="3" height="3" rx="1" fill="#1f2937" />
      <rect x="27" y="18" width="3" height="3" rx="1" fill="#1f2937" />
      <rect x="21" y="23" width="6" height="2" rx="1" fill="#c2410c" opacity="0.6" />
      <rect x="18" y="44" width="5" height="8" rx="1" fill="#374151" />
      <rect x="25" y="44" width="5" height="8" rx="1" fill="#374151" />
    </svg>
  );
}

export function LeadSprite({ lead, x, y, selected, onSelect }: LeadSpriteProps) {
  const tier = getMatchTier(lead.matchScore);
  const bodyColor = getTierColor(tier);
  const waving = tier === "hot";
  const scale = selected ? SPRITE_SCALE * 1.12 : SPRITE_SCALE;

  return (
    <button
      type="button"
      className={`absolute z-10 cursor-pointer transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md ${
        selected ? "sprite-selected-ring z-20" : ""
      }`}
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -100%) scale(${scale})`,
        transformOrigin: "bottom center",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(lead);
      }}
      aria-label={`Lead at ${lead.address}, score ${lead.matchScore}`}
    >
      <div className={`sprite-bob relative ${tier === "hot" ? "sprite-hot-glow" : ""}`}>
        {lead.urgent && (
          <div className="urgent-badge absolute -top-1 left-1/2 z-30 flex h-3.5 w-3.5 -translate-x-1/2 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow">
            !
          </div>
        )}
        <PixelCharacter
          variant={lead.spriteVariant}
          bodyColor={bodyColor}
          waving={waving}
        />
      </div>
    </button>
  );
}
