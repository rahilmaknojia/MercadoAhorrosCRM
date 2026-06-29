"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { Customer } from "@/lib/types";

export type EditState = { error?: string };

export async function updateCustomer(
  id: string,
  _prev: EditState,
  formData: FormData
): Promise<EditState> {
  const s = (key: string): string | null => {
    const value = formData.get(key);
    const trimmed = value ? String(value).trim() : "";
    return trimmed.length ? trimmed : null;
  };

  const contactName = s("contactName");
  if (!contactName) return { error: "Contact name is required." };

  // Load the current record so fields not exposed in the form (and required
  // non-null fields) are preserved rather than wiped by the PUT.
  let current: Customer;
  try {
    const res = await apiFetch(`/api/customers/${id}`);
    if (!res.ok) return { error: `Could not load the customer (${res.status}).` };
    current = (await res.json()) as Customer;
  } catch {
    return { error: "Could not load the customer." };
  }

  const body = {
    contactName,
    personTitle: s("personTitle"),
    businessName: s("businessName"),
    corpName: s("corpName"),
    salesTaxId: s("salesTaxId"),
    federalTaxId: s("federalTaxId"),
    storePhone: s("storePhone"),
    storeFax: s("storeFax"),
    cellPhone: s("cellPhone"),
    email: s("email"),
    storeAddress: s("storeAddress"),
    storeCity: s("storeCity"),
    storeState: s("storeState"),
    storeZipcode: s("storeZipcode"),
    district: s("district"),
    region: s("region"),
    mailingAddress: s("mailingAddress"),
    mailingCity: s("mailingCity"),
    mailingState: s("mailingState"),
    mailingZipcode: s("mailingZipcode"),
    storeGroup: s("storeGroup"),
    status: s("status") ?? current.status,
    dateJoined: s("dateJoined") ?? current.dateJoined,
    dateInactive: s("dateInactive"),
    inactiveReason: s("inactiveReason"),
    // Not exposed in the form — preserve.
    reinstated: current.reinstated ?? null,
    zoneNo: s("zoneNo"),
    zoneManager: s("zoneManager"),
    signedBy: s("signedBy"),
    comments: s("comments"),
  };

  const res = await apiFetch(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!res) return { error: "Your session has expired. Please sign in again." };
  if (res.status === 403) return { error: "You don't have permission to edit customers." };
  if (!res.ok) return { error: `Failed to save changes (${res.status}).` };

  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}
