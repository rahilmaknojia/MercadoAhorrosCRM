"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { pinColor, type MemberSurveyStatus } from "@/lib/survey-worklist";
import type { LatLng } from "@/lib/route-planning";

/**
 * Open-source map (MapLibre GL + OpenFreeMap tiles — free, no key, OpenStreetMap data) with one
 * pin per located store, coloured by this year's survey status. Stops on the route show their
 * visiting number and are joined by a line in order.
 */
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
const HOUSTON: [number, number] = [-95.37, 29.76];

// MapLibre's web worker is served from public/maplibre (scripts/sync-maplibre-worker.mjs): its
// default URL is relative to the library file, which no longer exists once Next bundles it.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type LocatedMember = MemberSurveyStatus & { latitude: number; longitude: number };

/** The route's start (e.g. office) or end (e.g. home), drawn as its own marker. */
export type RouteEnd = { kind: "start" | "end"; label: string; at: LatLng };

export function SurveyMap({
  members,
  route,
  visited,
  focusId,
  me,
  movableId,
  fitKey,
  onPinClick,
  onMoved,
  onMapClick,
  ends = [],
}: {
  members: LocatedMember[];
  /** Customer ids on the route, in visiting order. */
  route: number[];
  /** Route stops already surveyed (saved plans). */
  visited?: Set<number>;
  /** The pin whose details are open. */
  focusId: number | null;
  me: LatLng | null;
  /** A pin being moved by hand (draggable). */
  movableId: number | null;
  /** Change to re-fit the view to the pins (e.g. a new filter or plan). */
  fitKey: string;
  onPinClick: (member: LocatedMember) => void;
  onMoved: (customerId: number, at: LatLng) => void;
  /** Clicks on the map itself (used to place a pin for a store that has none). */
  onMapClick?: (at: LatLng) => void;
  /** Start/end markers; also joined to the route line. */
  ends?: RouteEnd[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const meMarker = useRef<Marker | null>(null);
  const endMarkers = useRef<Marker[]>([]);
  const ready = useRef(false);
  // Work that must wait for the style to load (the route source exists only after "load").
  const whenReady = useRef<(() => void)[]>([]);
  const onReady = (fn: () => void) => (ready.current ? fn() : whenReady.current.push(fn));
  // Latest callbacks, so markers built earlier never call stale handlers.
  const handlers = useRef({ onPinClick, onMoved, onMapClick });
  handlers.current = { onPinClick, onMoved, onMapClick };

  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: HOUSTON,
      zoom: 9,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("click", (e) => handlers.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    m.on("load", () => {
      m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#2563eb", "line-width": 3, "line-dasharray": [2, 1.5], "line-opacity": 0.8 },
      });
      ready.current = true;
      for (const fn of whenReady.current.splice(0)) fn();
    });
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
      map.current = null;
    };
  }, []);

  // Pins.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const mk of markers.current) mk.remove();
    markers.current = [];

    const order = new Map(route.map((id, i) => [id, i + 1]));
    for (const member of members) {
      const stop = order.get(member.customerId);
      const el = pinElement(member, stop, visited?.has(member.customerId) ?? false, member.customerId === focusId);
      const draggable = member.customerId === movableId;
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable })
        .setLngLat([member.longitude, member.latitude])
        .addTo(m);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.current.onPinClick(member);
      });
      if (draggable) {
        marker.on("dragend", () => {
          const p = marker.getLngLat();
          handlers.current.onMoved(member.customerId, { lat: p.lat, lng: p.lng });
        });
      }
      markers.current.push(marker);
    }
  }, [members, route, visited, focusId, movableId]);

  // Route line through the stops, in order.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const byId = new Map(members.map((x) => [x.customerId, x]));
    const start = ends.find((e) => e.kind === "start");
    const end = ends.find((e) => e.kind === "end");
    const coords = [
      ...(start ? [[start.at.lng, start.at.lat]] : []),
      ...route.map((id) => byId.get(id)).filter(Boolean).map((x) => [x!.longitude, x!.latitude]),
      ...(end ? [[end.at.lng, end.at.lat]] : []),
    ];
    const draw = () =>
      (m.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords.length > 1 ? coords : [] },
      });
    onReady(draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, route, JSON.stringify(ends)]);

  // Start / end markers.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const mk of endMarkers.current) mk.remove();
    endMarkers.current = ends.map((e) => {
      const el = document.createElement("div");
      el.className =
        "flex items-center gap-1 rounded-full border-2 border-white bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow";
      el.textContent = `${e.kind === "start" ? "Start" : "End"}: ${e.label}`;
      return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([e.at.lng, e.at.lat]).addTo(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ends)]);

  // The user's position.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    meMarker.current?.remove();
    meMarker.current = null;
    if (!me) return;
    const el = document.createElement("div");
    el.className = "size-4 rounded-full border-2 border-white bg-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.25)]";
    el.title = "You are here";
    meMarker.current = new maplibregl.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(m);
  }, [me]);

  // Fit to the pins (and the user) when asked.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const points = members.map((x) => [x.longitude, x.latitude] as [number, number]);
    if (me) points.push([me.lng, me.lat]);
    if (points.length === 0) return;
    const fit = () => {
      if (points.length === 1) {
        m.easeTo({ center: points[0], zoom: 13 });
        return;
      }
      const bounds = points.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(points[0], points[0]));
      m.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 400 });
    };
    onReady(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={container} className="h-full min-h-[420px] w-full rounded-xl" />;
}

/** A teardrop pin; route stops carry their number, visited stops a tick. */
function pinElement(member: MemberSurveyStatus, stop: number | undefined, visited: boolean, focused: boolean) {
  const color = pinColor(member);
  const el = document.createElement("button");
  el.type = "button";
  el.title = `${member.memberId ?? ""} ${member.businessName ?? ""}`.trim();
  el.setAttribute("aria-label", el.title);
  el.style.cursor = "pointer";
  const label = visited ? "✓" : stop ? String(stop) : member.status === "inProgress" ? "•" : "";
  const size = stop || focused ? 34 : 26;
  el.innerHTML = `
    <svg width="${size}" height="${Math.round(size * 1.3)}" viewBox="0 0 24 31" style="display:block;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))">
      <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 31 12 31s12-10.2 12-19.1C24 5.3 18.6 0 12 0z"
        fill="${color}" stroke="${focused ? "#111827" : "#ffffff"}" stroke-width="${focused ? 2 : 1.5}"/>
      <text x="12" y="16" text-anchor="middle" font-size="${stop && stop > 9 ? 9 : 11}" font-weight="700"
        font-family="system-ui, sans-serif" fill="#ffffff">${label}</text>
    </svg>`;
  return el;
}
