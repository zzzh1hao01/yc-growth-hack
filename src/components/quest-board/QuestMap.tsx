"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { Lead } from "@/types/lead";
import { LeadSprite } from "./LeadSprite";
import type { LassoState } from "./lasso-state";
import {
  applyCartoonMapStyle,
  getCartoonMapStyle,
  SF_DEFAULT_ZOOM,
  SF_MAP_CENTER,
} from "@/lib/map-cartoon-style";

type BusinessLocation = {
  lat: number;
  lng: number;
  label?: string;
};

type QuestMapProps = {
  leads: Lead[];
  selectedLeadId: string | null;
  lassoState?: LassoState | null;
  onSelectLead: (lead: Lead) => void;
  businessLocation?: BusinessLocation | null;
};

type SpritePosition = {
  lead: Lead;
  x: number;
  y: number;
  visible: boolean;
};

const SF_CENTER = SF_MAP_CENTER;
const DEFAULT_ZOOM = SF_DEFAULT_ZOOM;
const DRAG_HOLD = 0.68;
const DRAG_DURATION_MS = 3200;
const CAPTURE_DURATION_MS = 700;

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function LassoRope({
  from,
  to,
  tight,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  tight?: boolean;
}) {
  const midX = (from.x + to.x) / 2;
  const lift = tight ? 28 : 56;
  const midY = Math.min(from.y, to.y) - lift;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[15] h-full w-full overflow-visible"
      aria-hidden
    >
      <path
        className={`lasso-rope-line ${tight ? "lasso-rope-tight" : ""}`}
        d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y - 20}`}
      />
    </svg>
  );
}

export function QuestMap({
  leads,
  selectedLeadId,
  lassoState,
  onSelectLead,
  businessLocation,
}: QuestMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const businessMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const dragProgressRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [spritePositions, setSpritePositions] = useState<SpritePosition[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [dragProgress, setDragProgress] = useState(0);

  const updateSpritePositions = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    setSpritePositions(
      leads.map((lead) => {
        const point = map.project([lead.lng, lead.lat]);
        const bounds = map.getBounds();
        const inBounds = bounds ? bounds.contains([lead.lng, lead.lat]) : true;

        return {
          lead,
          x: point.x,
          y: point.y,
          visible: inBounds,
        };
      }),
    );
  }, [leads]);

  const scheduleSpriteUpdate = useCallback(() => {
    if (moveFrameRef.current != null) return;
    moveFrameRef.current = requestAnimationFrame(() => {
      moveFrameRef.current = null;
      updateSpritePositions();
    });
  }, [updateSpritePositions]);

  useEffect(() => {
    dragProgressRef.current = dragProgress;
  }, [dragProgress]);

  useEffect(() => {
    if (!lassoState) {
      setDragProgress(0);
      return;
    }

    if (lassoState.phase === "dragging") {
      const start = performance.now();
      let frame = 0;

      const tick = (now: number) => {
        const t = Math.min((now - start) / DRAG_DURATION_MS, 1);
        const progress = easeOutCubic(t) * DRAG_HOLD;
        setDragProgress(progress);
        if (t < 1) {
          frame = requestAnimationFrame(tick);
        }
      };

      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }

    if (lassoState.phase === "captured") {
      const from = dragProgressRef.current;
      const start = performance.now();
      let frame = 0;

      const tick = (now: number) => {
        const t = Math.min((now - start) / CAPTURE_DURATION_MS, 1);
        const progress = from + (1 - from) * easeOutCubic(t);
        setDragProgress(progress);
        if (t < 1) {
          frame = requestAnimationFrame(tick);
        }
      };

      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }
  }, [lassoState]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      setMapError(
        "Missing NEXT_PUBLIC_MAPBOX_TOKEN. Copy .env.local.example to .env.local and add your Mapbox token.",
      );
      return;
    }

    if (!mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: getCartoonMapStyle(),
      center: SF_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      applyCartoonMapStyle(map);
      setMapReady(true);
      updateSpritePositions();
    });

    map.on("move", scheduleSpriteUpdate);
    map.on("resize", scheduleSpriteUpdate);

    mapRef.current = map;

    return () => {
      if (moveFrameRef.current != null) {
        cancelAnimationFrame(moveFrameRef.current);
        moveFrameRef.current = null;
      }
      businessMarkerRef.current?.remove();
      businessMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [scheduleSpriteUpdate, updateSpritePositions]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    businessMarkerRef.current?.remove();
    businessMarkerRef.current = null;

    if (!businessLocation) return;

    const el = document.createElement("div");
    el.className = "business-location-pin";
    el.title = businessLocation.label ?? "Your business";
    el.innerHTML = `<span class="business-location-pin-icon" aria-hidden="true"></span><span class="business-location-pin-label">You</span>`;

    businessMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([businessLocation.lng, businessLocation.lat])
      .addTo(map);

    return () => {
      businessMarkerRef.current?.remove();
      businessMarkerRef.current = null;
    };
  }, [mapReady, businessLocation]);

  useEffect(() => {
    if (mapReady) {
      updateSpritePositions();
    }
  }, [mapReady, updateSpritePositions, leads]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoint = false;

    for (const lead of leads) {
      if (Number.isFinite(lead.lat) && Number.isFinite(lead.lng)) {
        bounds.extend([lead.lng, lead.lat]);
        hasPoint = true;
      }
    }

    if (businessLocation) {
      bounds.extend([businessLocation.lng, businessLocation.lat]);
      hasPoint = true;
    }

    if (hasPoint) {
      map.fitBounds(bounds, { padding: 100, maxZoom: 13, duration: 900 });
    }
  }, [mapReady, leads, businessLocation]);

  const lassoTarget = lassoState
    ? spritePositions.find((entry) => entry.lead.id === lassoState.leadId && entry.visible)
    : undefined;

  const lassoOrigin =
    businessLocation && mapRef.current && mapReady
      ? (() => {
          const point = mapRef.current!.project([businessLocation.lng, businessLocation.lat]);
          return { x: point.x, y: point.y };
        })()
      : lassoTarget
        ? { x: lassoTarget.x, y: Math.max(48, lassoTarget.y - 140) }
        : null;

  const lassoActive = Boolean(lassoState && lassoTarget && lassoOrigin);
  const captured = lassoState?.phase === "captured";

  const draggedPosition = lassoTarget && lassoOrigin && lassoActive
    ? {
        x: lassoTarget.x + (lassoOrigin.x - lassoTarget.x) * dragProgress,
        y: lassoTarget.y + (lassoOrigin.y - lassoTarget.y) * dragProgress,
      }
    : null;

  if (mapError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--western-bay-deep)] p-8 text-center">
        <div className="western-panel max-w-lg p-8">
          <p className="western-title mb-4 text-2xl">Map unavailable</p>
          <p className="western-body">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--western-bay-deep)]">
      <div className="map-cartoon-wrapper relative h-full w-full">
        <div
          ref={mapContainerRef}
          className="h-full w-full map-cartoon-filter"
          aria-label="San Francisco lead map"
        />
        <div className="pointer-events-none absolute inset-0 map-cartoon-overlay" />
        <div className="western-map-frame" aria-hidden />
      </div>
      <div className="pointer-events-none absolute inset-0 map-vignette" />
      {mapReady && lassoActive && draggedPosition && (
        <LassoRope
          from={lassoOrigin!}
          to={draggedPosition}
          tight={captured || dragProgress > 0.85}
        />
      )}
      {mapReady && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {spritePositions.map(({ lead, x, y, visible }) => {
            if (!visible) return null;

            const isLassoLead = lassoState?.leadId === lead.id;
            const displayX =
              isLassoLead && draggedPosition ? draggedPosition.x : x;
            const displayY =
              isLassoLead && draggedPosition ? draggedPosition.y : y;

            return (
              <div key={lead.id} className="pointer-events-auto">
                <LeadSprite
                  lead={lead}
                  x={displayX}
                  y={displayY}
                  selected={selectedLeadId === lead.id}
                  lassoPhase={isLassoLead ? lassoState?.phase : undefined}
                  onSelect={onSelectLead}
                />
              </div>
            );
          })}
        </div>
      )}
      {mapReady && captured && draggedPosition && (
        <div
          className="lasso-captured-badge pointer-events-none absolute z-[25] -translate-x-1/2 -translate-y-full"
          style={{ left: draggedPosition.x, top: draggedPosition.y - 36 }}
        >
          Captured · in CRM
        </div>
      )}
    </div>
  );
}
