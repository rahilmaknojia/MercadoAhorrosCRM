/**
 * Route planning for survey visits, done in the browser: order the chosen stores into a short
 * drive, then hand the ordered stops to Google Maps for turn-by-turn. Distances are straight-line
 * (haversine) — good enough to order a day's stops without running a routing server.
 */

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of visiting `stops` in order, from `start` and on to `end` when given. */
export function pathMiles<T extends LatLng>(stops: T[], start?: LatLng | null, end?: LatLng | null): number {
  let total = 0;
  let prev: LatLng | null = start ?? null;
  for (const s of [...stops, ...(end ? [end] : [])]) {
    if (prev) total += haversineMiles(prev, s);
    prev = s;
  }
  return total;
}

/**
 * A short visiting order: nearest-neighbour from `start` (or the first stop), then 2-opt until no
 * swap shortens the path. With an `end` (e.g. home) the last leg to it counts too; without one the
 * drive simply finishes at the last stop.
 */
export function optimizeRoute<T extends LatLng>(stops: T[], start?: LatLng | null, end?: LatLng | null): T[] {
  if (stops.length < 3 && !start && !end) return [...stops];

  // Nearest neighbour.
  const remaining = [...stops];
  const order: T[] = [];
  let here: LatLng = start ?? remaining[0];
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (haversineMiles(here, remaining[i]) < haversineMiles(here, remaining[best])) best = i;
    }
    here = remaining[best];
    order.push(remaining.splice(best, 1)[0]);
  }

  // 2-opt: reverse any segment whose reversal shortens the path.
  const cost = (path: T[]) => pathMiles(path, start, end);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (cost(candidate) + 1e-9 < cost(order)) {
          order.splice(0, order.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return order;
}

/** Google Maps allows at most 9 waypoints (plus a destination) per directions link. */
const STOPS_PER_LEG = 10;

/**
 * Google Maps driving-directions links for the ordered stops (then `end`, e.g. home), split into
 * legs of up to 10 points. The first leg starts at `origin` (e.g. the office) or, without one, at
 * the device's current location; each later leg starts where the previous one ended.
 */
export function googleMapsLegs(stops: LatLng[], origin?: LatLng | null, end?: LatLng | null): string[] {
  const fmt = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const points = [...stops, ...(end ? [end] : [])];
  const legs: string[] = [];
  for (let i = 0; i < points.length; i += STOPS_PER_LEG) {
    const chunk = points.slice(i, i + STOPS_PER_LEG);
    const p = new URLSearchParams({ api: "1", travelmode: "driving", destination: fmt(chunk[chunk.length - 1]) });
    if (i > 0) p.set("origin", fmt(points[i - 1]));
    else if (origin) p.set("origin", fmt(origin));
    if (chunk.length > 1) p.set("waypoints", chunk.slice(0, -1).map(fmt).join("|"));
    legs.push(`https://www.google.com/maps/dir/?${p.toString()}`);
  }
  return legs;
}

/** Directions to one store. */
export const googleMapsTo = (p: LatLng) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/**
 * A location pasted from Google Maps: plain coordinates ("30.012080, -95.466586") or a Google Maps
 * link. In links the place pin (`!3d<lat>!4d<lng>`) is preferred over the view centre (`@lat,lng`).
 * Returns an error message instead when the text can't be read.
 */
export function parseMapLocation(text: string): LatLng | { error: string } {
  const t = text.trim();
  if (!t) return { error: "Paste coordinates or a Google Maps link." };
  if (/(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(t)) {
    return { error: "Short links can't be read — open the link and copy the coordinates instead." };
  }
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`!3d${num}!4d${num}`),
    new RegExp(String.raw`@${num},${num}`),
    new RegExp(String.raw`[?&](?:q|ll|query|destination)=${num}(?:,|%2C)\s*${num}`, "i"),
    new RegExp(String.raw`^\(?\s*${num}\s*[,\s]\s*${num}\s*\)?$`),
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    return { error: "Those coordinates are out of range." };
  }
  return { error: "That doesn't look like a location — copy the coordinates from Google Maps." };
}

/** Google Maps search for an address, to find a store and copy its coordinates. */
export const googleMapsSearch = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
