"use client";

import type { Lead } from "@/types/lead";
import { getMatchTier, getTierColor } from "@/lib/lead-utils";
import type { LassoPhase } from "./lasso-state";

type LeadSpriteProps = {
  lead: Lead;
  x: number;
  y: number;
  selected: boolean;
  lassoPhase?: LassoPhase;
  onSelect: (lead: Lead) => void;
};

const SPRITE_SCALE = 0.62;
const SKIN = "#e8b896";
const HAT = "#8b6914";
const HAT_BRIM = "#6b5344";
const BOOT = "#5c3d2e";

const VARIANT_HAIR = ["#5c3d2e", "#2d2d2d", "#78350f", "#451a03"] as const;

function PixelCowboy({
  variant,
  bodyColor,
  bandColor,
}: {
  variant: Lead["spriteVariant"];
  bodyColor: string;
  bandColor: string;
}) {
  const hair = VARIANT_HAIR[variant];

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
      <ellipse cx="24" cy="52" rx="10" ry="2.5" fill="rgba(0,0,0,0.22)" />
      <rect x="16" y="28" width="16" height="18" fill={bodyColor} stroke="#451a03" strokeWidth="1" />
      <rect x="18" y="30" width="4" height="4" fill="rgba(255,255,255,0.35)" />
      <rect x="10" y="30" width="6" height="12" fill={bodyColor} stroke="#451a03" strokeWidth="1" />
      <rect x="32" y="30" width="6" height="12" fill={bodyColor} stroke="#451a03" strokeWidth="1" />
      <rect x="14" y="12" width="20" height="16" fill={SKIN} stroke="#451a03" strokeWidth="1" />
      <rect x="10" y="8" width="28" height="5" fill={HAT_BRIM} stroke="#451a03" strokeWidth="1" />
      <rect x="12" y="4" width="24" height="6" fill={HAT} stroke="#451a03" strokeWidth="1" />
      <rect x="11" y="9" width="26" height="4" fill={bandColor} stroke="#451a03" strokeWidth="1" />
      <rect x="14" y="14" width="4" height="6" fill={hair} />
      <rect x="30" y="14" width="4" height="6" fill={hair} />
      <rect x="18" y="18" width="3" height="3" fill="#1f2937" />
      <rect x="27" y="18" width="3" height="3" fill="#1f2937" />
      <rect x="21" y="23" width="6" height="2" fill="#92400e" opacity="0.7" />
      <rect x="18" y="44" width="5" height="8" fill={BOOT} stroke="#451a03" strokeWidth="1" />
      <rect x="25" y="44" width="5" height="8" fill={BOOT} stroke="#451a03" strokeWidth="1" />
    </svg>
  );
}

export function LeadSprite({ lead, x, y, selected, lassoPhase, onSelect }: LeadSpriteProps) {
  const tier = getMatchTier(lead.matchScore);
  const bodyColor = getTierColor(tier);
  const lassoing = Boolean(lassoPhase);
  const captured = lassoPhase === "captured";
  const scale = selected || lassoing ? SPRITE_SCALE * 1.1 : SPRITE_SCALE;

  return (
    <button
      type="button"
      className={`absolute z-10 cursor-pointer transition-transform duration-300 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
        selected ? "sprite-selected-ring z-20" : ""
      } ${lassoing ? "sprite-lassoing z-30" : ""} ${captured ? "sprite-lasso-captured" : ""}`}
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, -100%) scale(${scale})`,
        transformOrigin: "bottom center",
        transition: lassoing ? "left 80ms linear, top 80ms linear, transform 300ms ease" : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(lead);
      }}
      aria-label={`Lead at ${lead.address}, score ${lead.matchScore}`}
    >
      <div
        className={`relative ${lassoing ? "sprite-lasso-idle" : "sprite-bob"} ${tier === "hot" && !lassoing ? "sprite-hot-glow" : ""}`}
      >
        {lead.urgent && !lassoing && (
          <div className="urgent-badge absolute -top-1 left-1/2 z-30 flex h-3.5 w-3.5 -translate-x-1/2 items-center justify-center rounded-full bg-purple-600 text-[9px] font-bold text-white shadow">
            !
          </div>
        )}
        {lassoing && !captured && (
          <svg
            className="lasso-loop pointer-events-none absolute left-1/2 top-1/2 -z-10 h-20 w-20 -translate-x-1/2 -translate-y-1/2"
            viewBox="0 0 80 80"
            aria-hidden
          >
            <ellipse
              cx="40"
              cy="40"
              rx="28"
              ry="14"
              fill="none"
              stroke="#c2410c"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              opacity="0.85"
            />
          </svg>
        )}
        {captured && (
          <div
            className="lasso-capture-burst pointer-events-none absolute left-1/2 top-1/2 -z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400"
            aria-hidden
          />
        )}
        <PixelCowboy variant={lead.spriteVariant} bodyColor={bodyColor} bandColor={bodyColor} />
      </div>
    </button>
  );
}
