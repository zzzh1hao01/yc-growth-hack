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
const NEUTRAL_SKIN = "#e8c9a8";

/** Western variety: hat colors, hair colors, shirt colors — one neutral skin tone for all. */
const VARIANT_STYLES = [
  { hair: "#5c3d2e", hatBand: "#22c55e", shirt: "#7c9eb8", hat: "#c4956a" },
  { hair: "#2d2d2d", hatBand: "#eab308", shirt: "#b8956a", hat: "#8b6914" },
  { hair: "#d97706", hatBand: "#ef4444", shirt: "#9aaea0", hat: "#d4a574" },
  { hair: "#7c3aed", hatBand: "#22c55e", shirt: "#c4a574", hat: "#a67c52" },
] as const;

function WesternPixelCharacter({
  variant,
  qualityColor,
}: {
  variant: Lead["spriteVariant"];
  qualityColor: string;
}) {
  const style = VARIANT_STYLES[variant];

  return (
    <svg
      width="48"
      height="56"
      viewBox="0 0 48 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="pixel-sprite-svg"
      shapeRendering="crispEdges"
    >
      <ellipse cx="24" cy="52" rx="10" ry="2.5" fill="rgba(0,0,0,0.12)" />
      {/* Body / shirt */}
      <rect x="16" y="28" width="16" height="18" rx="0" fill={style.shirt} />
      <rect x="18" y="30" width="4" height="4" fill="rgba(255,255,255,0.25)" />
      <rect x="10" y="30" width="6" height="12" rx="0" fill={style.shirt} />
      <rect x="32" y="30" width="6" height="12" rx="0" fill={style.shirt} />
      {/* Head — neutral tone */}
      <rect x="14" y="12" width="20" height="16" rx="0" fill={NEUTRAL_SKIN} />
      {/* Cowboy hat */}
      <rect x="10" y="8" width="28" height="5" rx="0" fill={style.hat} />
      <rect x="12" y="4" width="24" height="6" rx="0" fill={style.hat} />
      {/* Hat band — contact quality color */}
      <rect x="12" y="10" width="24" height="3" fill={qualityColor} />
      {/* Hair peeking out */}
      <rect x="14" y="14" width="4" height="6" fill={style.hair} />
      <rect x="30" y="14" width="4" height="6" fill={style.hair} />
      {/* Eyes */}
      <rect x="18" y="18" width="3" height="3" fill="#1f2937" />
      <rect x="27" y="18" width="3" height="3" fill="#1f2937" />
      {/* Boots */}
      <rect x="18" y="44" width="5" height="8" fill="#5c3d2e" />
      <rect x="25" y="44" width="5" height="8" fill="#5c3d2e" />
    </svg>
  );
}

export function LeadSprite({ lead, x, y, selected, onSelect }: LeadSpriteProps) {
  const tier = getMatchTier(lead.matchScore);
  const qualityColor = getTierColor(tier);
  const scale = selected ? SPRITE_SCALE * 1.12 : SPRITE_SCALE;

  return (
    <button
      type="button"
      className={`absolute z-10 cursor-pointer transition-transform duration-150 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c] ${
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
      aria-label={`Contact in ${lead.neighborhood ?? "San Francisco"}, quality ${lead.matchScore}`}
    >
      <div className={`sprite-bob relative ${tier === "hot" ? "sprite-hot-glow" : ""}`}>
        <WesternPixelCharacter variant={lead.spriteVariant} qualityColor={qualityColor} />
      </div>
    </button>
  );
}
