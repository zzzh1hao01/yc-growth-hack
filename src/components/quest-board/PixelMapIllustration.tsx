"use client";

import {
  CACTUS_POSITIONS,
  getLandmarkPixelPositions,
  getNeighborhoodPixelPositions,
  LAND_SILHOUETTE_PATH,
  SAILBOATS,
  TUMBLEWEED_POSITION,
} from "@/lib/pixel-map-data";
import { MAP_HEIGHT, MAP_WIDTH } from "@/lib/pixel-map-projection";

function Cactus({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-decor">
      <rect x="0" y="8" width="4" height="14" fill="#5a7a4a" />
      <rect x="-5" y="12" width="4" height="8" fill="#5a7a4a" />
      <rect x="5" y="10" width="4" height="10" fill="#5a7a4a" />
      <rect x="-1" y="4" width="6" height="4" fill="#6b8f5a" />
    </g>
  );
}

function Tumbleweed({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-decor tumbleweed-spin">
      <circle cx="0" cy="0" r="8" fill="#c4a574" opacity="0.85" />
      <circle cx="-3" cy="-2" r="3" fill="#b8956a" />
      <circle cx="4" cy="1" r="2.5" fill="#d4b896" />
      <circle cx="1" cy="4" r="2" fill="#a8845a" />
    </g>
  );
}

function Sailboat({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-decor">
      <polygon points="0,-12 8,8 -8,8" fill={color} stroke="#8b7355" strokeWidth="1" />
      <rect x="-1" y="8" width="2" height="6" fill="#6b5344" />
    </g>
  );
}

function WoodSign({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-sign">
      <rect x="-2" y="-18" width="2" height="20" fill="#6b5344" />
      <rect x="-28" y="-22" width="56" height="14" rx="1" fill="#c4956a" stroke="#6b5344" strokeWidth="1.5" />
      <line x1="-26" y1="-20" x2="26" y2="-20" stroke="#a67c52" strokeWidth="0.5" />
      <line x1="-26" y1="-16" x2="26" y2="-16" stroke="#a67c52" strokeWidth="0.5" />
      <text
        x="0"
        y="-11"
        textAnchor="middle"
        className="pixel-sign-text"
        fontSize="7"
        fontWeight="700"
        fill="#451a03"
      >
        {label}
      </text>
    </g>
  );
}

function GoldenGateBridge({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <rect x="-30" y="0" width="60" height="3" fill="#c2410c" />
      <rect x="-28" y="-18" width="4" height="18" fill="#b45309" />
      <rect x="24" y="-18" width="4" height="18" fill="#b45309" />
      <path d="M -28 -18 Q 0 -28 28 -18" fill="none" stroke="#c2410c" strokeWidth="2" />
    </g>
  );
}

function CoitTower({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <rect x="-4" y="-20" width="8" height="20" fill="#f5e6c8" stroke="#92400e" strokeWidth="1" />
      <rect x="-3" y="-22" width="6" height="3" fill="#d97706" />
    </g>
  );
}

function TransamericaPyramid({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <polygon points="0,-24 10,0 -10,0" fill="#fde68a" stroke="#92400e" strokeWidth="1" />
    </g>
  );
}

function FerryBuilding({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <rect x="-12" y="-8" width="24" height="8" fill="#f5e6c8" stroke="#92400e" strokeWidth="1" />
      <rect x="-4" y="-16" width="8" height="8" fill="#d97706" />
      <rect x="-2" y="-20" width="4" height="4" fill="#f59e0b" />
    </g>
  );
}

function Alcatraz({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <ellipse cx="0" cy="0" rx="14" ry="8" fill="#d4c4a8" stroke="#8b7355" strokeWidth="1" />
      <rect x="-6" y="-6" width="12" height="6" fill="#f5e6c8" />
    </g>
  );
}

function SutroTower({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <line x1="0" y1="0" x2="-8" y2="-22" stroke="#6b7280" strokeWidth="2" />
      <line x1="0" y1="0" x2="8" y2="-22" stroke="#6b7280" strokeWidth="2" />
      <line x1="-8" y1="-22" x2="8" y2="-22" stroke="#6b7280" strokeWidth="2" />
      <line x1="0" y1="0" x2="0" y2="-22" stroke="#9ca3af" strokeWidth="1.5" />
    </g>
  );
}

function PaintedLadies({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      {[-12, -4, 4, 12].map((ox, i) => (
        <g key={ox} transform={`translate(${ox}, 0)`}>
          <rect x="-3" y="-10" width="6" height="10" fill={["#f9a8d4", "#93c5fd", "#fde68a", "#86efac"][i]} />
          <polygon points="-4,-10 0,-14 4,-10" fill="#92400e" />
        </g>
      ))}
    </g>
  );
}

function Windmill({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <rect x="-2" y="-4" width="4" height="8" fill="#6b5344" />
      <line x1="0" y1="-4" x2="0" y2="-14" stroke="#8b7355" strokeWidth="1.5" />
      <line x1="0" y1="-9" x2="-8" y2="-6" stroke="#d4c4a8" strokeWidth="1.5" />
      <line x1="0" y1="-9" x2="8" y2="-6" stroke="#d4c4a8" strokeWidth="1.5" />
    </g>
  );
}

function OraclePark({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <ellipse cx="0" cy="0" rx="16" ry="10" fill="#22c55e" opacity="0.7" />
      <rect x="-8" y="-4" width="16" height="4" fill="#f97316" />
    </g>
  );
}

function PalaceOfFineArts({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <ellipse cx="0" cy="0" rx="12" ry="8" fill="#f5e6c8" stroke="#92400e" strokeWidth="1" />
      <rect x="-2" y="-10" width="4" height="10" fill="#d4c4a8" />
    </g>
  );
}

function TwinPeaksHill({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <ellipse cx="-6" cy="0" rx="10" ry="8" fill="#8b9a6b" />
      <ellipse cx="6" cy="2" rx="10" ry="8" fill="#7a8a5c" />
    </g>
  );
}

function LombardStreet({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="pixel-landmark">
      <path d="M -10 4 Q -5 -4 0 4 Q 5 -4 10 4" fill="none" stroke="#86efac" strokeWidth="3" />
    </g>
  );
}

const LANDMARK_RENDERERS: Record<string, (props: { x: number; y: number }) => React.JSX.Element> = {
  "gg-bridge": GoldenGateBridge,
  "painted-ladies": PaintedLadies,
  "coit-tower": CoitTower,
  transamerica: TransamericaPyramid,
  "ferry-building": FerryBuilding,
  "sutro-tower": SutroTower,
  alcatraz: Alcatraz,
  "palace-fine-arts": PalaceOfFineArts,
  "twin-peaks": TwinPeaksHill,
  "ggp-windmill": Windmill,
  "oracle-park": OraclePark,
  lombard: LombardStreet,
};

export function PixelMapIllustration() {
  const landmarks = getLandmarkPixelPositions();
  const neighborhoods = getNeighborhoodPixelPositions();

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      className="pixel-map-svg"
      aria-hidden
    >
      <defs>
        <clipPath id="sf-land-clip">
          <path d={LAND_SILHOUETTE_PATH} fillRule="evenodd" />
        </clipPath>
      </defs>

      {/* Water */}
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#4a9eb8" />
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#5eb4cc" opacity="0.4" />

      {/* Land mass */}
      <path
        d={LAND_SILHOUETTE_PATH}
        fillRule="evenodd"
        fill="#e8d4b0"
        stroke="#c4a574"
        strokeWidth="2"
      />

      {/* Subtle land texture inside clip */}
      <g clipPath="url(#sf-land-clip)">
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f0e0c4" opacity="0.5" />
        {CACTUS_POSITIONS.map((pos, i) => (
          <Cactus key={i} x={pos.x} y={pos.y} />
        ))}
        <Tumbleweed x={TUMBLEWEED_POSITION.x} y={TUMBLEWEED_POSITION.y} />
      </g>

      {/* Sailboats in bay (outside land clip) */}
      {SAILBOATS.map((boat, i) => (
        <Sailboat key={i} x={boat.x} y={boat.y} color={boat.color} />
      ))}

      {/* Landmarks */}
      {landmarks.map((lm) => {
        const Renderer = LANDMARK_RENDERERS[lm.id];
        if (!Renderer) return null;
        return <Renderer key={lm.id} x={lm.x} y={lm.y} />;
      })}

      {/* Neighborhood signs */}
      {neighborhoods.map((nb) => (
        <WoodSign key={nb.id} x={nb.x} y={nb.y} label={nb.name} />
      ))}
    </svg>
  );
}
