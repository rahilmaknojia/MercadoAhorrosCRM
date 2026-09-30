"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, MapPin, Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import {
  checkStoreAddress,
  deletePlace,
  savePlace,
  type RoutePoint,
  type UserPlace,
} from "@/app/(app)/surveys/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { googleMapsSearch, parseMapLocation, type LatLng } from "@/lib/route-planning";

/** A saved place as a route start/end. */
export const placePoint = (p: UserPlace): RoutePoint => ({
  label: p.label,
  address: p.address,
  latitude: p.latitude,
  longitude: p.longitude,
});

type Draft = { label: string; street: string; city: string; state: string; zipcode: string };

/**
 * Add or edit a place (e.g. Office, Home), or enter a one-off address for a route's start/end.
 * The address is looked up ("Find"), or a location pasted from Google Maps is used as-is.
 */
export function PlaceDialog({
  open,
  place,
  allowUseOnce,
  onClose,
  onUse,
}: {
  open: boolean;
  /** Editing an existing place; null adds a new one. */
  place: UserPlace | null;
  /** Offer "Use for this route" without saving (the "Another address…" option). */
  allowUseOnce: boolean;
  onClose: () => void;
  /** The chosen point, when the dialog was opened to pick a start/end. */
  onUse?: (point: RoutePoint) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <PlaceForm key={place?.id ?? "new"} place={place} allowUseOnce={allowUseOnce} onClose={onClose} onUse={onUse} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlaceForm({
  place,
  allowUseOnce,
  onClose,
  onUse,
}: {
  place: UserPlace | null;
  allowUseOnce: boolean;
  onClose: () => void;
  onUse?: (point: RoutePoint) => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    label: place?.label ?? "",
    street: place?.street ?? "",
    city: place?.city ?? "",
    state: place?.state ?? "TX",
    zipcode: place?.zipcode ?? "",
  });
  const [pasted, setPasted] = useState("");
  const [found, setFound] = useState<(LatLng & { matched: string | null }) | null>(
    place ? { lat: place.latitude, lng: place.longitude, matched: place.address } : null
  );
  const [notFound, setNotFound] = useState(false);
  const [busy, start] = useTransition();

  const location = pasted.trim() ? parseMapLocation(pasted) : null;
  const pin = location && !("error" in location) ? location : null;
  const point = pin ?? found;
  const addressText = [draft.street, draft.city, `${draft.state} ${draft.zipcode}`.trim()].filter(Boolean).join(", ");

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if ("street" in patch || "city" in patch || "state" in patch || "zipcode" in patch) {
      setFound(null);
      setNotFound(false);
    }
  };

  function find() {
    start(async () => {
      const res = await checkStoreAddress({ street: draft.street, city: draft.city, state: draft.state, zipcode: draft.zipcode });
      if (!res.ok) return void toast.error(res.error);
      if (res.data.found && res.data.latitude !== null && res.data.longitude !== null) {
        setFound({ lat: res.data.latitude, lng: res.data.longitude, matched: res.data.matchedAddress });
        setNotFound(false);
      } else {
        setFound(null);
        setNotFound(true);
      }
    });
  }

  function useOnce() {
    if (!point) return;
    onUse?.({ label: draft.label.trim() || null, address: addressText || null, latitude: point.lat, longitude: point.lng });
    onClose();
  }

  function save() {
    if (!draft.label.trim()) return void toast.error("Give the place a name, e.g. Office or Home.");
    start(async () => {
      const res = await savePlace(place?.id ?? null, {
        ...draft,
        ...(point ? { latitude: point.lat, longitude: point.lng } : {}),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Saved "${res.data.label}".`);
      onUse?.(placePoint(res.data));
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{place ? `Edit ${place.label}` : allowUseOnce ? "Route start or end" : "Add a place"}</DialogTitle>
        <DialogDescription>
          Enter the address and find it, or paste the location from Google Maps. Save it as a place (e.g. Office, Home)
          to reuse it on every route.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-6">
        <div className="space-y-1 sm:col-span-6">
          <Label htmlFor="place-label">Name</Label>
          <Input id="place-label" value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="Office, Home, Warehouse…" maxLength={60} />
        </div>
        <div className="space-y-1 sm:col-span-6">
          <Label htmlFor="place-street">Street address</Label>
          <Input id="place-street" value={draft.street} onChange={(e) => set({ street: e.target.value })} />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label htmlFor="place-city">City</Label>
          <Input id="place-city" value={draft.city} onChange={(e) => set({ city: e.target.value })} />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="place-state">State</Label>
          <Input
            id="place-state"
            value={draft.state}
            maxLength={2}
            onChange={(e) => set({ state: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="place-zip">ZIP code</Label>
          <Input
            id="place-zip"
            value={draft.zipcode}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => set({ zipcode: e.target.value.replace(/[^\d-]/g, "") })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={find} disabled={busy || !draft.street.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Search />} Find address
        </Button>
        {found && !pin && (
          <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" /> {found.matched ?? "Found"}
          </span>
        )}
        {notFound && !pin && (
          <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-3.5" /> Not found — paste the location from Google Maps below.
          </span>
        )}
      </div>

      <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="place-location" className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> Location from Google Maps <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <a
            href={googleMapsSearch(addressText || draft.label)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open in Google Maps <ExternalLink className="size-3" />
          </a>
        </div>
        <Input
          id="place-location"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="e.g. 30.012080, -95.466586 or a Google Maps link"
        />
        {location && "error" in location ? (
          <p className="text-xs text-destructive">{location.error}</p>
        ) : pin ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Location set · {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
          </p>
        ) : null}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {allowUseOnce && (
          <Button variant="outline" onClick={useOnce} disabled={busy || !point}>
            Use for this route
          </Button>
        )}
        <Button onClick={save} disabled={busy || !draft.label.trim() || (!point && !draft.street.trim())}>
          {busy && <Loader2 className="animate-spin" />} {place ? "Save changes" : "Save place"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** List, add, edit and delete the user's places. */
export function MyPlacesDialog({ open, places, onClose }: { open: boolean; places: UserPlace[]; onClose: () => void }) {
  const [editing, setEditing] = useState<UserPlace | "new" | null>(null);
  const [busy, start] = useTransition();

  function remove(p: UserPlace) {
    if (!confirm(`Delete "${p.label}"?`)) return;
    start(async () => {
      const res = await deletePlace(p.id);
      if (!res.ok) toast.error(res.error);
      else toast.success(`Deleted "${p.label}".`);
    });
  }

  return (
    <>
      <Dialog open={open && editing === null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>My places</DialogTitle>
            <DialogDescription>Places you start or end your routes at, like your office and home.</DialogDescription>
          </DialogHeader>
          {places.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {places.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.address || `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}</div>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${p.label}`} onClick={() => setEditing(p)} disabled={busy}>
                    <Pencil />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${p.label}`} onClick={() => remove(p)} disabled={busy}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button onClick={() => setEditing("new")} disabled={places.length >= 10}>
              <Plus /> Add a place
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PlaceDialog
        open={open && editing !== null}
        place={editing === "new" ? null : editing}
        allowUseOnce={false}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
