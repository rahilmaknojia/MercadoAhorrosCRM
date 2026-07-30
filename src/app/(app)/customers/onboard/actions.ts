"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { Customer, CustomerVendorSelectionGroup } from "@/lib/types";

export type OnboardResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type OnboardingMemberInput = {
  contactName: string;
  personTitle?: string;
  businessName?: string;
  corpName?: string;
  email?: string;
  storePhone?: string;
  cellPhone?: string;
  storeFax?: string;
  storeAddress?: string;
  storeCity?: string;
  storeState?: string;
  storeZipcode?: string;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZipcode?: string;
  region?: string;
  district?: string;
  zoneNo?: string;
  zoneManager?: string;
  storeGroup?: string;
  salesTaxId?: string;
  federalTaxId?: string;
  status?: string;
};

/** Creates the member (member details + store details) and returns its id + MA number. */
export async function createOnboardingMember(
  input: OnboardingMemberInput,
): Promise<OnboardResult<{ id: number; memberId: string | null }>> {
  if (!input.contactName?.trim()) return { ok: false, error: "Contact name is required." };

  const clean = (v?: string) => {
    const t = v?.trim();
    return t ? t : undefined;
  };

  const body = {
    contactName: input.contactName.trim(),
    personTitle: clean(input.personTitle),
    businessName: clean(input.businessName),
    corpName: clean(input.corpName),
    email: clean(input.email),
    storePhone: clean(input.storePhone),
    cellPhone: clean(input.cellPhone),
    storeFax: clean(input.storeFax),
    storeAddress: clean(input.storeAddress),
    storeCity: clean(input.storeCity),
    storeState: clean(input.storeState),
    storeZipcode: clean(input.storeZipcode),
    mailingAddress: clean(input.mailingAddress),
    mailingCity: clean(input.mailingCity),
    mailingState: clean(input.mailingState),
    mailingZipcode: clean(input.mailingZipcode),
    region: clean(input.region),
    district: clean(input.district),
    zoneNo: clean(input.zoneNo),
    zoneManager: clean(input.zoneManager),
    storeGroup: clean(input.storeGroup),
    salesTaxId: clean(input.salesTaxId),
    federalTaxId: clean(input.federalTaxId),
    status: clean(input.status) ?? "Pending",
  };

  const res = await apiFetch("/api/customers", {
    method: "POST",
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (res.status === 403) return { ok: false, error: "You don't have permission to create members." };
  if (!res.ok) return { ok: false, error: `Failed to create member (${res.status}).` };

  const customer = (await res.json()) as Customer;
  revalidatePath("/customers");
  return { ok: true, data: { id: customer.id, memberId: customer.memberId ?? null } };
}

/** Loads the member's vendor selection groups (for the vendors step). */
export async function fetchVendorGroups(
  customerId: number,
): Promise<OnboardResult<CustomerVendorSelectionGroup[]>> {
  const res = await apiFetch(`/api/customers/${customerId}/vendors`).catch(() => null);
  if (!res || !res.ok) return { ok: false, error: "Could not load vendors." };
  const groups = (await res.json()) as CustomerVendorSelectionGroup[];
  return { ok: true, data: Array.isArray(groups) ? groups : [] };
}

/** Stores the captured customer signature (base64 PNG data URL) in StoreMetadata (merge-safe). */
export async function saveCustomerSignature(
  customerId: number,
  dataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/storemetadata/by-customer/${customerId}`, {
    method: "PATCH",
    body: JSON.stringify({ jsonData: JSON.stringify({ __customerSignature: dataUrl }) }),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Network error." };
  if (res.status === 403) return { ok: false, error: "You don't have permission to save the signature." };
  if (!res.ok) return { ok: false, error: "Could not save the signature." };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
