"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Crosshair,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  Move,
  Navigation,
  Plus,
  Route,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteRoutePlan,
  getRoutePlan,
  runGeocoding,
  saveRoutePlan,
  setStoreLocation,
  type RoutePoint,
  type UserPlace,
} from "@/app/(app)/surveys/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  googleMapsLegs,
  googleMapsSearch,
  googleMapsTo,
  optimizeRoute,
  pathMiles,
  type LatLng,
} from "@/lib/route-planning";
import {
  formatDay,
  PIN_COLORS,
  pinColor,
  STATUS_META,
  SURVEYED_TODAY_COLOR,
  LOCATION_REASON,
  type GeocodingStatus,
  type LocationStatus,
  type MemberSurveyStatus,
  type RoutePlanSummary,
} from "@/lib/survey-worklist";
import { cn } from "@/lib/utils";
import { FixAddressDialog } from "./fix-address-dialog";
import { MyPlacesDialog, PlaceDialog, placePoint } from "./place-dialogs";
import type { LocatedMember, RouteEnd } from "./survey-map";

const SurveyMap = dynamic(() => import("./survey-map").then((m) => m.SurveyMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> Loading map…
    </div>
  ),
});

const isLocated = (m: MemberSurveyStatus): m is LocatedMember => m.latitude !== null && m.longitude !== null;
const today = () => new Date().toLocaleDateString("en-CA"); // yyyy-MM-dd, local

type EditingPlan = { id: number | null; name: string; date: string };

/** Where the route starts or ends: the device's location, the first/last stop, or a place/address. */
type EndChoice = { kind: "me" } | { kind: "stop" } | { kind: "point"; point: RoutePoint };

const ENDS_KEY = "crm.surveys.routeEnds";
function loadEnds(): { start: EndChoice; end: EndChoice } {
  try {
    const saved = JSON.parse(localStorage.getItem(ENDS_KEY) ?? "null");
    if (saved?.start && saved?.end) return saved;
  } catch {
    // no storage (private window): defaults
  }
  return { start: { kind: "me" }, end: { kind: "stop" } };
}
const pointOf = (c: EndChoice, me: LatLng | null): LatLng | null =>
  c.kind === "me" ? me : c.kind === "point" ? { lat: c.point.latitude, lng: c.point.longitude } : null;

/**
 * Map-based survey planning: colour-coded store pins, a route tray (optimise, open in Google Maps,
 * save as a day plan) and the zone manager's saved plans, which tick off as surveys are submitted.
 */
export function SurveyPlanner({
  members,
  allMembers,
  plans,
  geocoding,
  canMovePins,
  zoneManagerId,
  places,
}: {
  /** Members after the page's status filter and search (the pins shown). */
  members: MemberSurveyStatus[];
  /** Every member on the list, so a saved plan's stops resolve even when filtered out. */
  allMembers: MemberSurveyStatus[];
  plans: RoutePlanSummary[];
  geocoding: GeocodingStatus | null;
  /** May place pins by hand and run "Locate now" (customers:update). */
  canMovePins: boolean;
  /** Set when an admin is planning for another zone manager. */
  zoneManagerId: number | null;
  /** The user's saved places (Office, Home) for the route's start and end. */
  places: UserPlace[];
}) {
  const [route, setRoute] = useState<number[]>([]);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const [focus, setFocus] = useState<LocatedMember | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [movableId, setMovableId] = useState<number | null>(null);
  // A store with no location, waiting for a click on the map to place its pin.
  const [placing, setPlacing] = useState<MemberSurveyStatus | null>(null);
  // The store whose address is being corrected.
  const [fixing, setFixing] = useState<MemberSurveyStatus | null>(null);
  const [editing, setEditing] = useState<EditingPlan>({ id: null, name: "", date: today() });
  const [fitKey, setFitKey] = useState("initial");
  const [startChoice, setStartChoice] = useState<EndChoice>({ kind: "me" });
  const [endChoice, setEndChoice] = useState<EndChoice>({ kind: "stop" });
  // Restore the last start/end after mount (localStorage isn't available during SSR).
  useEffect(() => {
    const saved = loadEnds();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartChoice(saved.start);
    setEndChoice(saved.end);
  }, []);
  // Entering a one-off address for the start or end; or managing saved places.
  const [pickingFor, setPickingFor] = useState<"start" | "end" | null>(null);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [pending, start] = useTransition();

  const located = useMemo(() => members.filter(isLocated), [members]);
  const byId = useMemo(() => new Map(allMembers.map((m) => [m.customerId, m])), [allMembers]);
  const routeStops = route.map((id) => byId.get(id)).filter((m): m is MemberSurveyStatus => !!m);
  const routePoints = routeStops.filter(isLocated).map((m) => ({ lat: m.latitude, lng: m.longitude }));
  // Plan stops stay on the map even when the status filter hides them.
  const pins = useMemo(() => {
    const shown = new Set(located.map((m) => m.customerId));
    const extra = route.map((id) => byId.get(id)).filter((m): m is LocatedMember => !!m && isLocated(m) && !shown.has(m.customerId));
    return [...located, ...extra];
  }, [located, route, byId]);
  const unlocated = members.length - located.length;
  const startPoint = pointOf(startChoice, me);
  const endPoint = pointOf(endChoice, me);
  const miles = pathMiles(routePoints, startPoint, endPoint);
  const ends: RouteEnd[] = [
    ...(startChoice.kind === "point"
      ? [{ kind: "start" as const, label: startChoice.point.label ?? "Start", at: startPoint! }]
      : []),
    ...(endChoice.kind === "point" ? [{ kind: "end" as const, label: endChoice.point.label ?? "End", at: endPoint! }] : []),
  ];
  // Google Maps: a place/address start is the origin; "first stop" makes the first stop the origin;
  // "my location" leaves it out so Google starts from the phone's position.
  const legs =
    startChoice.kind === "stop" && routePoints.length > 0
      ? googleMapsLegs(routePoints.slice(1), routePoints[0], endPoint)
      : googleMapsLegs(routePoints, startChoice.kind === "point" ? startPoint : null, endPoint);

  function chooseEnd(which: "start" | "end", choice: EndChoice) {
    const next = which === "start" ? { start: choice, end: endChoice } : { start: startChoice, end: choice };
    if (which === "start") setStartChoice(choice);
    else setEndChoice(choice);
    try {
      localStorage.setItem(ENDS_KEY, JSON.stringify(next));
    } catch {
      // remembered only for this visit
    }
    if (choice.kind === "me" && !me) locateMe();
  }

  function toggleStop(id: number) {
    setRoute((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  }
  function move(index: number, delta: number) {
    setRoute((r) => {
      const next = [...r];
      const [item] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item);
      return next;
    });
  }

  /** Ask the browser for the user's position; `then` gets it, or null when unavailable. */
  function locateMe(then?: (at: LatLng | null) => void) {
    if (!navigator.geolocation) {
      toast.error("This browser can't share your location.");
      then?.(null);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(at);
        setLocating(false);
        setFitKey(`me-${Date.now()}`);
        then?.(at);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location. Check the browser's location permission.");
        then?.(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function optimize() {
    const run = (at: LatLng | null) => {
      const s = pointOf(startChoice, at);
      const e = pointOf(endChoice, at);
      const stops = routeStops.filter(isLocated).map((m) => ({ id: m.customerId, lat: m.latitude, lng: m.longitude }));
      const ordered = optimizeRoute(stops, s, e).map((x) => x.id);
      const unplaced = route.filter((id) => !ordered.includes(id));
      setRoute([...ordered, ...unplaced]);
      const from =
        startChoice.kind === "point" ? (startChoice.point.label ?? "the start") : s ? "your location" : "the first stop";
      const to =
        endChoice.kind === "point"
          ? ` to ${endChoice.point.label ?? "the end"}`
          : endChoice.kind === "me" && e
            ? " back to your location"
            : "";
      toast.success(`Route ordered from ${from}${to}.`);
    };
    const needsMe = startChoice.kind === "me" || endChoice.kind === "me";
    if (needsMe && !me) locateMe(run);
    else run(me);
  }

  function addTodoInView() {
    const todo = located.filter((m) => m.status === "notStarted" || m.status === "inProgress").map((m) => m.customerId);
    setRoute((r) => [...r, ...todo.filter((id) => !r.includes(id))].slice(0, 60));
    if (todo.length > 60) toast.message("A plan holds at most 60 stops; the first 60 were added.");
  }

  function newPlan() {
    setRoute([]);
    setVisited(new Set());
    setEditing({ id: null, name: "", date: today() });
  }

  function openPlan(plan: RoutePlanSummary) {
    start(async () => {
      const res = await getRoutePlan(plan.id);
      if (!res.ok) return void toast.error(res.error);
      setRoute(res.data.stops.map((s) => s.member.customerId));
      setVisited(new Set(res.data.stops.filter((s) => s.visited).map((s) => s.member.customerId)));
      setEditing({ id: plan.id, name: plan.name, date: plan.planDate ?? "" });
      if (plan.start) setStartChoice({ kind: "point", point: plan.start });
      if (plan.end) setEndChoice({ kind: "point", point: plan.end });
      setFitKey(`plan-${plan.id}-${Date.now()}`);
    });
  }

  function save() {
    if (route.length === 0) return void toast.error("Add stops to the route first.");
    start(async () => {
      const res = await saveRoutePlan(editing.id, {
        name: editing.name,
        planDate: editing.date || null,
        customerIds: route,
        zoneManagerId,
        // "My location" is wherever the phone is on the day, so it isn't stored.
        start: startChoice.kind === "point" ? startChoice.point : null,
        end: endChoice.kind === "point" ? endChoice.point : null,
      });
      if (!res.ok) return void toast.error(res.error);
      setEditing({ id: res.data.summary.id, name: res.data.summary.name, date: res.data.summary.planDate ?? "" });
      toast.success(editing.id ? "Plan updated." : `Saved "${res.data.summary.name}".`);
    });
  }

  function remove(plan: RoutePlanSummary) {
    if (!confirm(`Delete the plan "${plan.name}"?`)) return;
    start(async () => {
      const res = await deleteRoutePlan(plan.id);
      if (!res.ok) return void toast.error(res.error);
      if (editing.id === plan.id) newPlan();
      toast.success("Plan deleted.");
    });
  }

  function locateStores(retryNotFound = false) {
    start(async () => {
      const res = await runGeocoding(retryNotFound);
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        `Located ${res.data.located} store${res.data.located === 1 ? "" : "s"}` +
          (res.data.noMatch ? `; ${res.data.noMatch} address${res.data.noMatch === 1 ? "" : "es"} couldn't be found` : "") +
          (res.data.stillPending ? `; ${res.data.stillPending} still queued` : "") +
          "."
      );
    });
  }

  function savePin(customerId: number, at: LatLng) {
    start(async () => {
      const res = await setStoreLocation(customerId, at.lat, at.lng);
      if (!res.ok) return void toast.error(res.error);
      setMovableId(null);
      setPlacing(null);
      toast.success("Pin moved. It stays there until the store address changes.");
    });
  }

  return (
    <div className="space-y-3">
      {unlocated > 0 && (
        <UnlocatedNotice
          members={members.filter((m) => !isLocated(m))}
          total={members.length}
          canLocate={canMovePins}
          busy={pending}
          onLocate={locateStores}
          onPlace={setPlacing}
          onFix={setFixing}
        />
      )}

      <FixAddressDialog member={fixing} onClose={() => setFixing(null)} onStillNotFound={setPlacing} />
      <PlaceDialog
        open={pickingFor !== null}
        place={null}
        allowUseOnce
        onClose={() => setPickingFor(null)}
        onUse={(point) => pickingFor && chooseEnd(pickingFor, { kind: "point", point })}
      />
      <MyPlacesDialog open={placesOpen} places={places} onClose={() => setPlacesOpen(false)} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative h-[65vh] min-h-[420px] overflow-hidden rounded-xl border">
          <SurveyMap
            members={pins}
            route={route}
            visited={visited}
            focusId={focus?.customerId ?? null}
            me={me}
            movableId={movableId}
            fitKey={fitKey}
            onPinClick={setFocus}
            onMoved={savePin}
            onMapClick={placing ? (at) => savePin(placing.customerId, at) : undefined}
            ends={ends}
          />
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            <Legend />
            <Button size="sm" variant="secondary" className="shadow" onClick={() => locateMe()} disabled={locating}>
              {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} My location
            </Button>
          </div>
          {placing && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg bg-background/95 px-3 py-2 text-sm shadow">
              <Crosshair className="size-4" /> Click the map where <span className="font-medium">{placing.memberId}</span>{" "}
              {placing.businessName} is.
              <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setPlacing(null)}>
                Cancel
              </Button>
            </div>
          )}
          {movableId !== null && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg bg-background/95 px-3 py-2 text-sm shadow">
              <Move className="size-4" /> Drag the highlighted pin to the store&apos;s real spot.
              <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => setMovableId(null)}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {focus && (
            <StoreCard
              member={focus}
              onRoute={route.includes(focus.customerId)}
              onToggle={() => toggleStop(focus.customerId)}
              onClose={() => setFocus(null)}
              canMove={canMovePins}
              onMove={() => setMovableId(focus.customerId)}
              onFixAddress={() => setFixing(focus)}
            />
          )}

          <section className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Route className="size-4" /> {editing.id ? "Editing plan" : "Route"}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {route.length} stop{route.length === 1 ? "" : "s"}
                {routePoints.length > 0 && (routePoints.length > 1 || startPoint || endPoint) ? ` · ~${miles.toFixed(1)} mi` : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <EndPicker
                label="Start"
                value={startChoice}
                places={places}
                special={[
                  { kind: "me", label: "My location" },
                  { kind: "stop", label: "First stop" },
                ]}
                onChange={(c) => chooseEnd("start", c)}
                onOther={() => setPickingFor("start")}
              />
              <EndPicker
                label="End"
                value={endChoice}
                places={places}
                special={[
                  { kind: "stop", label: "Last stop" },
                  { kind: "me", label: "My location" },
                ]}
                onChange={(c) => chooseEnd("end", c)}
                onOther={() => setPickingFor("end")}
              />
            </div>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setPlacesOpen(true)}>
              {places.length ? `My places (${places.length})` : "Add your office or home as a place"}
            </button>

            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addTodoInView}>
                <Plus /> Add to-do in view
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={optimize} disabled={route.length < 2}>
                <Sparkles /> Optimize order
              </Button>
              {route.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={newPlan}>
                  <X /> Clear
                </Button>
              )}
            </div>

            {route.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Click pins and choose &ldquo;Add to route&rdquo;, or add every to-do store in view. Then optimise the order
                and open it in Google Maps.
              </p>
            ) : (
              <ol className="max-h-72 space-y-1 overflow-y-auto">
                {routeStops.map((m, i) => (
                  <li key={m.customerId} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/60">
                    <span
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: pinColor(m) }}
                    >
                      {visited.has(m.customerId) ? <Check className="size-3" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className={cn(
                          "block w-full truncate text-left",
                          visited.has(m.customerId) && "text-muted-foreground line-through"
                        )}
                        onClick={() => isLocated(m) && setFocus(m)}
                      >
                        <span className="font-medium">{m.memberId}</span> {m.businessName}
                        {!isLocated(m) && <span className="ml-1 text-xs text-amber-600">(not on map)</span>}
                      </button>
                      {(m.address || m.city) && (
                        <a
                          href={
                            isLocated(m)
                              ? googleMapsTo({ lat: m.latitude, lng: m.longitude })
                              : googleMapsSearch([m.address, m.city, m.state, m.zipcode].filter(Boolean).join(", "))
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Directions to this store in Google Maps"
                          className="block truncate text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          {[m.address, m.city].filter(Boolean).join(", ")}
                        </a>
                      )}
                    </div>
                    <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === route.length - 1}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton label="Remove from route" onClick={() => toggleStop(m.customerId)} danger>
                      <X />
                    </IconButton>
                  </li>
                ))}
              </ol>
            )}

            {routePoints.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {legs.map((href, i, all) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Navigation className="size-3.5" />
                    {all.length === 1 ? "Open in Google Maps" : `Leg ${i + 1} of ${all.length}`}
                  </a>
                ))}
              </div>
            )}

            {route.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                    placeholder={`Route ${editing.date ? formatDay(`${editing.date}T12:00:00`) : ""}`.trim()}
                    className="h-8 text-sm"
                    aria-label="Plan name"
                  />
                  <Input
                    type="date"
                    value={editing.date}
                    onChange={(e) => setEditing((p) => ({ ...p, date: e.target.value }))}
                    className="h-8 w-36 text-sm"
                    aria-label="Plan date"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={save} disabled={pending}>
                    {pending ? <Loader2 className="animate-spin" /> : <Save />} {editing.id ? "Update plan" : "Save day plan"}
                  </Button>
                  {editing.id && (
                    <Button size="sm" variant="ghost" onClick={newPlan}>
                      New plan
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2 rounded-xl border bg-card p-4 shadow-xs">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <CalendarDays className="size-4" /> Day plans
            </h3>
            {plans.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved plans yet.</p>
            ) : (
              <ul className="space-y-1">
                {plans.map((p) => (
                  <li
                    key={p.id}
                    className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm", editing.id === p.id && "bg-muted")}
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openPlan(p)}>
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {p.planDate ? formatDay(`${p.planDate}T12:00:00`) : "No date"}
                        <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full bg-emerald-600"
                            style={{ width: `${p.stops ? (100 * p.visited) / p.stops : 0}%` }}
                          />
                        </span>
                        {p.visited}/{p.stops} visited
                      </div>
                    </button>
                    <IconButton label={`Delete ${p.name}`} onClick={() => remove(p)}>
                      <Trash2 />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Which stores on this list aren't on the map and why, with a way to fix each: correct the
 * address (the geocoder retries on its own), retry the geocoder, or open the store to place a pin.
 */
function UnlocatedNotice({
  members,
  total,
  canLocate,
  busy,
  onLocate,
  onPlace,
  onFix,
}: {
  members: MemberSurveyStatus[];
  total: number;
  canLocate: boolean;
  busy: boolean;
  onLocate: (retryNotFound: boolean) => void;
  /** Start placing this store's pin by clicking the map. */
  onPlace: (member: MemberSurveyStatus) => void;
  /** Open the address fix for this store. */
  onFix: (member: MemberSurveyStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = (s: LocationStatus) => members.filter((m) => m.locationStatus === s).length;
  const reasons = (["notFound", "pending", "noAddress"] as const).map((s) => [s, count(s)] as const).filter(([, n]) => n > 0);

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <MapPin className="size-4 shrink-0" />
        <span className="font-medium">
          {members.length} of {total} stores aren&apos;t on the map
        </span>
        {reasons.map(([s, n]) => (
          <span key={s} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs dark:bg-amber-500/20">
            {n} · {LOCATION_REASON[s].toLowerCase()}
          </span>
        ))}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide list" : "Show list"}
          </Button>
          {canLocate && count("pending") > 0 && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => onLocate(false)} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Crosshair />} Locate now
            </Button>
          )}
          {canLocate && count("notFound") > 0 && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => onLocate(true)} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Crosshair />} Retry not found
            </Button>
          )}
        </div>
      </div>
      {open && (
        <ul className="max-h-60 divide-y divide-amber-200/60 overflow-y-auto rounded-md bg-background/70 text-foreground dark:divide-amber-500/20">
          {members.map((m) => (
            <li key={m.customerId} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-xs">
              <span className="font-medium">{m.memberId}</span>
              <span className="min-w-0 flex-1 truncate">
                {m.businessName}
                <span className="text-muted-foreground">
                  {" · "}
                  {[m.address, m.city, [m.state, m.zipcode].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "no address"}
                </span>
              </span>
              <span className="text-amber-700 dark:text-amber-300">
                {m.locationStatus === "located" ? "" : LOCATION_REASON[m.locationStatus]}
              </span>
              {canLocate ? (
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => onFix(m)}>
                  Fix address
                </button>
              ) : (
                <Link href={`/customers/${m.customerId}`} className="font-medium text-primary hover:underline">
                  View member
                </Link>
              )}
              {canLocate && (
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => onPlace(m)}>
                  Place pin
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs opacity-80">
        Use Fix address to correct a store&apos;s address — it&apos;s placed on the map as soon as you save. If the
        address is right but still not found, use Place pin and click the store&apos;s spot on the map.
      </p>
    </div>
  );
}

function StoreCard({
  member: m,
  onRoute,
  onToggle,
  onClose,
  canMove,
  onMove,
  onFixAddress,
}: {
  member: LocatedMember;
  onRoute: boolean;
  onToggle: () => void;
  onClose: () => void;
  canMove: boolean;
  onMove: () => void;
  onFixAddress: () => void;
}) {
  const meta = STATUS_META[m.status];
  return (
    <section className="space-y-2 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">
            {m.memberId} <span className="font-normal">{m.businessName}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {[m.address, m.city, [m.state, m.zipcode].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
          </div>
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("rounded-full px-2 py-0.5 font-medium", meta.className)}>
          {m.status === "inProgress" && m.draftVersion ? `Draft v${m.draftVersion}` : meta.label}
        </span>
        <span className="text-muted-foreground">
          {m.lastSurveyedOn
            ? `Last surveyed ${formatDay(m.lastSurveyedOn)}${m.lastSurveyedBy ? ` by ${m.lastSurveyedBy}` : ""}`
            : m.previousSurveyOn
              ? `Last surveyed ${formatDay(m.previousSurveyOn)}`
              : "Never surveyed"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link
          href={`/customers/${m.customerId}?tab=survey`}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {m.draftVersion ? "Continue draft" : m.status === "notStarted" ? "Start survey" : "View survey"}
        </Link>
        <Button size="sm" variant={onRoute ? "secondary" : "outline"} className="h-8 text-xs" onClick={onToggle}>
          {onRoute ? <X /> : <Plus />} {onRoute ? "Remove from route" : "Add to route"}
        </Button>
        <a
          href={googleMapsTo({ lat: m.latitude, lng: m.longitude })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-muted"
        >
          <ExternalLink className="size-3.5" /> Navigate
        </a>
        {canMove && (
          <>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onFixAddress}>
              <MapPin /> Edit address
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onMove}>
              <Move /> Move pin
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function Legend() {
  const item = (color: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
  return (
    <div className="space-y-1 rounded-lg bg-background/95 px-2.5 py-2 text-xs shadow">
      {item(PIN_COLORS.notStarted, "Not surveyed this year")}
      {item(PIN_COLORS.completed, "Surveyed once")}
      {item(PIN_COLORS.recommendedMet, "Surveyed twice")}
      {item(SURVEYED_TODAY_COLOR, "Surveyed today")}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Destructive action (e.g. remove from route): turns red on hover. */
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 [&_svg]:size-3.5",
        danger && "hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}

/** Choose a route start or end: my location, first/last stop, a saved place, or another address. */
function EndPicker({
  label,
  value,
  places,
  special,
  onChange,
  onOther,
}: {
  label: string;
  value: EndChoice;
  places: UserPlace[];
  special: { kind: "me" | "stop"; label: string }[];
  onChange: (choice: EndChoice) => void;
  onOther: () => void;
}) {
  const matching =
    value.kind === "point"
      ? places.find((p) => p.latitude === value.point.latitude && p.longitude === value.point.longitude)
      : undefined;
  const current = value.kind !== "point" ? value.kind : matching ? `place-${matching.id}` : "custom";
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span className="block">{label}</span>
      <select
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "me" || v === "stop") onChange({ kind: v });
          else if (v === "other") onOther();
          else if (v.startsWith("place-")) {
            const place = places.find((p) => `place-${p.id}` === v);
            if (place) onChange({ kind: "point", point: placePoint(place) });
          }
        }}
      >
        {special.map((o) => (
          <option key={o.kind} value={o.kind}>
            {o.label}
          </option>
        ))}
        {places.map((p) => (
          <option key={p.id} value={`place-${p.id}`}>
            {p.label}
          </option>
        ))}
        {current === "custom" && value.kind === "point" && (
          <option value="custom">{value.point.label || value.point.address || "Custom address"}</option>
        )}
        <option value="other">Another address…</option>
      </select>
    </label>
  );
}
