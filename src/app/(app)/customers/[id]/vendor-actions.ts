"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { ActionResult } from "@/app/(app)/customers/[id]/cooler-actions";

export type VendorSelectionInput = {
  vendorId: number;
  /** Omit to leave the stored account number untouched; "" clears it. */
  accountNumber?: string | null;
};

/**
 * Replaces the member's vendor selections (Preferred / Other / Ice Cream) with exactly
 * `selections`, saving each vendor's account number in the same call. The API diffs rather than
 * delete-and-recreate, so JSON data on selections that stay is preserved, and it enforces the
 * N/A exclusivity rule server-side.
 */
export async function setCustomerVendors(
  customerId: number,
  selections: VendorSelectionInput[]
): Promise<ActionResult> {
  const res = await apiFetch(`/api/customers/${customerId}/vendors`, {
    method: "PUT",
    body: JSON.stringify({ selections }),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Could not reach the API." };
  if (res.status === 403) return { ok: false, error: "You do not have permission to edit this member." };
  if (!res.ok) return { ok: false, error: "Failed to save vendors." };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
