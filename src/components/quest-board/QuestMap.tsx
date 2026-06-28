"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { Lead } from "@/types/lead";
import { LeadSprite } from "./LeadSprite";
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

export function QuestMap({
  leads,
  selectedLeadId,
  onSelectLead,
  businessLocation,
}: QuestMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const businessMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [spritePositions, setSpritePositions] = useState<SpritePosition[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

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
    el.innerHTML = `<span class="business-location-pin-icon">📍</span><span class="business-location-pin-label">You</span>`;

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

  if (mapError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#e8f4f8] p-8 text-center">
        <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-[#fff9f0] p-8 max-w-lg">
          <p className="text-4xl mb-4">🗺️</p>
          <h2 className="text-xl font-bold text-amber-950 mb-2">Mapbox token required</h2>
          <p className="text-sm text-amber-900/70 leading-relaxed">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#d4e8c2]">
      <div className="map-cartoon-wrapper relative h-full w-full">
        <div
          ref={mapContainerRef}
          className="h-full w-full map-cartoon-filter"
          aria-label="San Francisco lead map"
        />
        <div className="pointer-events-none absolute inset-0 map-cartoon-overlay" />
      </div>
      <div className="pointer-events-none absolute inset-0 map-vignette" />
      {mapReady && (
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
      )}
    </div>
  );
}
