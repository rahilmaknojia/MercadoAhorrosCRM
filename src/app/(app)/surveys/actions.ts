"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { GeocodingStatus, RoutePlanDetail } from "@/lib/survey-worklist";

/** Survey-planning server actions: day route plans, geocoding, hand-placed pins. */

export type PlanResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function failure(res: Response | null, fallback: string): Promise<{ ok: false; error: string }> {
  if (!res) return { ok: false, error: "Could not reach the API." };
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  if (res.status === 403) return { ok: false, error: body?.message ?? "You do not have permission to do that." };
  return { ok: false, error: body?.message ?? fallback };
}

/** A route's start or end (e.g. the office / home). */
export type RoutePoint = { label: string | null; address: string | null; latitude: number; longitude: number };

export type SavePlanInput = {
  start?: RoutePoint | null;
  end?: RoutePoint | null;
  name: string;
  /** yyyy-MM-dd */
  planDate: string | null;
  customerIds: number[];
  /** Plan for another zone manager (owner/admin). */
  zoneManagerId?: number | null;
};

export async function getRoutePlan(id: number): Promise<PlanResult<RoutePlanDetail>> {
  const res = await apiFetch(`/api/site-surveys/route-plans/${id}`).catch(() => null);
  if (!res?.ok) return failure(res, "Could not load the plan.");
  return { ok: true, data: (await res.json()) as RoutePlanDetail };
}

export async function saveRoutePlan(id: number | null, input: SavePlanInput): Promise<PlanResult<RoutePlanDetail>> {
  const res = await apiFetch(id ? `/api/site-surveys/route-plans/${id}` : "/api/site-surveys/route-plans", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(input),
  }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not save the plan.");
  revalidatePath("/surveys");
  return { ok: true, data: (await res.json()) as RoutePlanDetail };
}

export async function deleteRoutePlan(id: number): Promise<PlanResult<null>> {
  const res = await apiFetch(`/api/site-surveys/route-plans/${id}`, { method: "DELETE" }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not delete the plan.");
  revalidatePath("/surveys");
  return { ok: true, data: null };
}

/** Geocode pending store addresses now (the API also does this in the background). */
export async function runGeocoding(retryNotFound = false): Promise<
  PlanResult<{ processed: number; located: number; noMatch: number; stillPending: number }>
> {
  const res = await apiFetch(`/api/geocoding/run${retryNotFound ? "?retryNotFound=true" : ""}`, { method: "POST" }).catch(
    () => null
  );
  if (!res?.ok) return failure(res, "Could not locate stores.");
  revalidatePath("/surveys");
  return { ok: true, data: await res.json() };
}

export async function getGeocodingStatus(): Promise<PlanResult<GeocodingStatus>> {
  const res = await apiFetch("/api/geocoding/status").catch(() => null);
  if (!res?.ok) return failure(res, "Could not load locating status.");
  return { ok: true, data: (await res.json()) as GeocodingStatus };
}

/** Place a store's pin by hand (kept until its address changes). */
export async function setStoreLocation(customerId: number, latitude: number, longitude: number): Promise<PlanResult<null>> {
  const res = await apiFetch(`/api/geocoding/customers/${customerId}/location`, {
    method: "PUT",
    body: JSON.stringify({ latitude, longitude }),
  }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not move the pin.");
  revalidatePath("/surveys");
  return { ok: true, data: null };
}

export type StoreAddress = { street: string; city: string; state: string; zipcode: string };
export type AddressCheck = { found: boolean; matchedAddress: string | null; latitude: number | null; longitude: number | null };
export type StoreLocation = {
  locationStatus: "located" | "pending" | "notFound" | "noAddress";
  latitude: number | null;
  longitude: number | null;
  matchedAddress: string | null;
};

/** Look an address up without saving it. */
export async function checkStoreAddress(address: StoreAddress): Promise<PlanResult<AddressCheck>> {
  const res = await apiFetch("/api/geocoding/check", { method: "POST", body: JSON.stringify(address) }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not check the address.");
  return { ok: true, data: (await res.json()) as AddressCheck };
}

/** Correct a store's address and locate it straight away (optionally with a hand-placed pin). */
export async function updateStoreAddress(
  customerId: number,
  address: StoreAddress & { latitude?: number; longitude?: number }
): Promise<PlanResult<StoreLocation>> {
  const res = await apiFetch(`/api/geocoding/customers/${customerId}/store-address`, {
    method: "PUT",
    body: JSON.stringify(address),
  }).catch(() => null);
  if (res?.status === 403) return { ok: false, error: "You don't have permission to edit store addresses." };
  if (!res?.ok) return failure(res, "Could not save the address.");
  revalidatePath("/surveys");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: (await res.json()) as StoreLocation };
}

// ---- my places (route start/end: Office, Home, …) --------------------------------------------------

export type UserPlace = {
  id: number;
  label: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  latitude: number;
  longitude: number;
  address: string;
};

export type SavePlaceInput = {
  label: string;
  street: string;
  city: string;
  state: string;
  zipcode: string;
  /** Exact location (pasted from Google Maps); otherwise the address is looked up. */
  latitude?: number;
  longitude?: number;
};

export async function savePlace(id: number | null, input: SavePlaceInput): Promise<PlanResult<UserPlace>> {
  const res = await apiFetch(id ? `/api/me/places/${id}` : "/api/me/places", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(input),
  }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not save the place.");
  revalidatePath("/surveys");
  return { ok: true, data: (await res.json()) as UserPlace };
}

export async function deletePlace(id: number): Promise<PlanResult<null>> {
  const res = await apiFetch(`/api/me/places/${id}`, { method: "DELETE" }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not delete the place.");
  revalidatePath("/surveys");
  return { ok: true, data: null };
}
