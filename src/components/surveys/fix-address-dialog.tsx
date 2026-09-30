"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, MapPin, Search, TriangleAlert } from "lucide-react";
import {
  checkStoreAddress,
  updateStoreAddress,
  type AddressCheck,
  type StoreAddress,
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
import { googleMapsSearch, parseMapLocation } from "@/lib/route-planning";
import type { MemberSurveyStatus } from "@/lib/survey-worklist";

/**
 * Fix a store's address from the survey map — for stores the map couldn't locate (or located in the
 * wrong spot). "Check address" looks it up without saving; "Save" updates the member's store
 * address (logged to its activity) and locates it straight away.
 */
export function FixAddressDialog({
  member,
  onClose,
  onStillNotFound,
}: {
  /** The store being fixed; null closes the dialog. */
  member: MemberSurveyStatus | null;
  onClose: () => void;
  /** Saved, but the address still can't be found: let the user drop the pin by hand. */
  onStillNotFound: (member: MemberSurveyStatus) => void;
}) {
  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {member && (
          <FixAddressForm key={member.customerId} member={member} onClose={onClose} onStillNotFound={onStillNotFound} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FixAddressForm({
  member,
  onClose,
  onStillNotFound,
}: {
  member: MemberSurveyStatus;
  onClose: () => void;
  onStillNotFound: (member: MemberSurveyStatus) => void;
}) {
  const [address, setAddress] = useState<StoreAddress>({
    street: member.address ?? "",
    city: member.city ?? "",
    state: (member.state ?? "TX").toUpperCase(),
    zipcode: member.zipcode ?? "",
  });
  const [check, setCheck] = useState<AddressCheck | null>(null);
  // A location pasted from Google Maps (coordinates or a page link) — used as the pin.
  const [pasted, setPasted] = useState("");
  const location = pasted.trim() ? parseMapLocation(pasted) : null;
  const pin = location && !("error" in location) ? location : null;
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();

  const set = (patch: Partial<StoreAddress>) => {
    setAddress((a) => ({ ...a, ...patch }));
    setCheck(null); // a new address needs a new check
  };

  const problem = !address.street.trim()
    ? "Enter the street address."
    : address.zipcode && !/^\d{5}(-\d{4})?$/.test(address.zipcode.trim())
      ? "The ZIP code should be 5 digits."
      : !address.zipcode.trim() && !(address.city.trim() && address.state.trim())
        ? "Enter the ZIP code, or the city and state."
        : null;

  function runCheck() {
    startCheck(async () => {
      const res = await checkStoreAddress(address);
      if (!res.ok) return void toast.error(res.error);
      setCheck(res.data);
    });
  }

  function save() {
    startSave(async () => {
      const res = await updateStoreAddress(
        member.customerId,
        pin ? { ...address, latitude: pin.lat, longitude: pin.lng } : address
      );
      if (!res.ok) return void toast.error(res.error);
      if (res.data.locationStatus === "located") {
        toast.success(pin ? "Address and location saved — the store is on the map." : "Address saved — the store is on the map.");
        onClose();
      } else {
        toast.message("Address saved, but it still can't be found. Click the store's spot on the map to place its pin.");
        onClose();
        onStillNotFound({ ...member, address: address.street, city: address.city, state: address.state, zipcode: address.zipcode });
      }
    });
  }

  const busy = checking || saving;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Fix store address</DialogTitle>
        <DialogDescription>
          {member.memberId} {member.businessName}. Correct the address so the store can be placed on the map. The
          change is saved to the member and noted in its activity.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-6">
        <Field className="sm:col-span-6" id="fix-street" label="Street address">
          <Input
            id="fix-street"
            value={address.street}
            onChange={(e) => set({ street: e.target.value })}
            placeholder="e.g. 8200 Bellfort Ave"
            disabled={busy}
            autoFocus
          />
        </Field>
        <Field className="sm:col-span-3" id="fix-city" label="City">
          <Input id="fix-city" value={address.city} onChange={(e) => set({ city: e.target.value })} disabled={busy} />
        </Field>
        <Field className="sm:col-span-1" id="fix-state" label="State">
          <Input
            id="fix-state"
            value={address.state}
            maxLength={2}
            onChange={(e) => set({ state: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
            disabled={busy}
          />
        </Field>
        <Field className="sm:col-span-2" id="fix-zip" label="ZIP code">
          <Input
            id="fix-zip"
            value={address.zipcode}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => set({ zipcode: e.target.value.replace(/[^\d-]/g, "") })}
            disabled={busy}
          />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        Leave out suite or unit numbers if the address isn&apos;t found — the map only needs the street address.
      </p>

      {check &&
        (check.found ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>
              Found: <span className="font-medium">{check.matchedAddress}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Not found. Double-check the street number, street name and ZIP. If it&apos;s right, save anyway and
              place the pin on the map.
            </span>
          </div>
        ))}

      <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="fix-location" className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> Location from Google Maps <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <a
            href={googleMapsSearch([address.street, address.city, `${address.state} ${address.zipcode}`.trim()].filter(Boolean).join(", "))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open in Google Maps <ExternalLink className="size-3" />
          </a>
        </div>
        <Input
          id="fix-location"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="e.g. 30.012080, -95.466586 or a Google Maps link"
          disabled={busy}
        />
        {location && "error" in location ? (
          <p className="text-xs text-destructive">{location.error}</p>
        ) : pin ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Pin will be placed at {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)} (used instead of looking the address up).
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            If the address can&apos;t be found: in Google Maps right-click the store (long-press on a phone), click the
            coordinates to copy them, and paste here — or paste the page link.
          </p>
        )}
      </div>

      {problem && <p className="text-xs text-destructive">{problem}</p>}

      <DialogFooter className="gap-2 sm:justify-between">
        <Button variant="outline" onClick={runCheck} disabled={busy || !!problem}>
          {checking ? <Loader2 className="animate-spin" /> : <Search />} Check address
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !!problem || (location !== null && "error" in location)}>
            {saving && <Loader2 className="animate-spin" />} {pin ? "Save address & location" : "Save address"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
