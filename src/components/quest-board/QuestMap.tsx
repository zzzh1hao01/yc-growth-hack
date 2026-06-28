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

type QuestMapProps = {
  leads: Lead[];
  selectedLeadId: string | null;
  onSelectLead: (lead: Lead) => void;
};

type SpritePosition = {
  lead: Lead;
  x: number;
  y: number;
  visible: boolean;
};

const SF_CENTER = SF_MAP_CENTER;
const DEFAULT_ZOOM = SF_DEFAULT_ZOOM;

export function QuestMap({ leads, selectedLeadId, onSelectLead }: QuestMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
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

    map.on("move", updateSpritePositions);
    map.on("resize", updateSpritePositions);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [updateSpritePositions]);

  useEffect(() => {
    if (mapReady) {
      updateSpritePositions();
    }
  }, [mapReady, updateSpritePositions, leads]);

  if (mapError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#e8f4f8] p-8 text-center">
        <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-[#fff9f0] p-8 max-w-lg">
          <p className="text-4xl mb-4">🗺️</p>
          <h2 className="text-xl font-bold text-amber-950 mb-2">Mapbox token required</h2>
          <p className="text-sm text-amber-900/70 leading-relaxed">{mapError}</p>
          <pre className="mt-4 rounded-lg bg-amber-950/5 p-3 text-left text-xs text-amber-950 overflow-x-auto">
            cp .env.local.example .env.local{"\n"}
            # add NEXT_PUBLIC_MAPBOX_TOKEN=pk...{"\n"}
            npm run dev
          </pre>
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
