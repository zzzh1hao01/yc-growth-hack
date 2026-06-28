"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Lead } from "@/types/lead";
import {
  fitViewportToPoints,
  lngLatToPixel,
  MAP_HEIGHT,
  MAP_WIDTH,
  projectToScreen,
  type MapViewport,
} from "@/lib/pixel-map-projection";
import { LeadSprite } from "./LeadSprite";
import { PixelMapIllustration } from "./PixelMapIllustration";

type BusinessLocation = {
  lat: number;
  lng: number;
  label?: string;
};

type QuestMapProps = {
  leads: Lead[];
  selectedLeadId: string | null;
  onSelectLead: (lead: Lead) => void;
  businessLocation?: BusinessLocation | null;
};

type SpritePosition = {
  lead: Lead;
  x: number;
  y: number;
  visible: boolean;
};

const DEFAULT_VIEWPORT: MapViewport = { panX: 0, panY: 0, scale: 1 };

export function QuestMap({
  leads,
  selectedLeadId,
  onSelectLead,
  businessLocation,
}: QuestMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  );
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_VIEWPORT);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [spritePositions, setSpritePositions] = useState<SpritePosition[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [hasFitted, setHasFitted] = useState(false);

  const updateSpritePositions = useCallback(() => {
    const { width, height } = containerSize;
    if (width <= 0 || height <= 0) return;

    setSpritePositions(
      leads.map((lead) => {
        const screen = projectToScreen(lead.lng, lead.lat, viewport, width, height);
        const inBounds =
          screen.x >= -20 &&
          screen.x <= width + 20 &&
          screen.y >= -40 &&
          screen.y <= height + 20;

        return { lead, x: screen.x, y: screen.y, visible: inBounds };
      }),
    );
  }, [leads, viewport, containerSize]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    updateSpritePositions();
  }, [updateSpritePositions]);

  useEffect(() => {
    if (hasFitted || containerSize.width <= 0 || leads.length === 0) return;

    const points = leads.map((l) => lngLatToPixel(l.lng, l.lat));
    if (businessLocation) {
      points.push(lngLatToPixel(businessLocation.lng, businessLocation.lat));
    }

    const fitted = fitViewportToPoints(
      points,
      containerSize.width,
      containerSize.height,
      100,
    );
    setViewport(fitted);
    setHasFitted(true);
  }, [leads, businessLocation, containerSize, hasFitted]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: viewport.panX,
        panY: viewport.panY,
      };
      setIsDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [viewport.panX, viewport.panY],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setViewport((v) => ({
      ...v,
      panX: dragRef.current!.panX + dx,
      panY: dragRef.current!.panY + dy,
    }));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const mapTransform = `translate(${(containerSize.width - MAP_WIDTH * viewport.scale) / 2 + viewport.panX}px, ${(containerSize.height - MAP_HEIGHT * viewport.scale) / 2 + viewport.panY}px) scale(${viewport.scale})`;

  const businessPixel =
    businessLocation && containerSize.width > 0
      ? projectToScreen(
          businessLocation.lng,
          businessLocation.lat,
          viewport,
          containerSize.width,
          containerSize.height,
        )
      : null;

  return (
    <div
      ref={containerRef}
      className={`pixel-map-container relative h-full w-full overflow-hidden ${isDragging ? "pixel-map-dragging" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label="San Francisco coverage map"
    >
      <div
        className="pixel-map-layer absolute origin-top-left"
        style={{
          width: MAP_WIDTH,
          height: MAP_HEIGHT,
          transform: mapTransform,
        }}
      >
        <PixelMapIllustration />
      </div>

      {businessPixel && (
        <div
          className="business-pin pointer-events-none absolute z-10"
          style={{
            left: businessPixel.x,
            top: businessPixel.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="business-pin-marker" />
          <span className="business-pin-label">You</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {spritePositions.map(
          ({ lead, x, y, visible }) =>
            visible && (
              <div key={lead.id} className="pointer-events-auto">
                <LeadSprite
                  lead={lead}
                  x={x}
                  y={y}
                  selected={selectedLeadId === lead.id}
                  onSelect={onSelectLead}
                />
              </div>
            ),
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 pixel-map-vignette" />
    </div>
  );
}
