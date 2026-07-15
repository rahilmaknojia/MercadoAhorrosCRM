"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { ActionResult } from "@/app/(app)/customers/[id]/cooler-actions";

/**
 * Replaces the member's vendor selections (Preferred / Other / Ice Cream) with exactly
 * `vendorIds`. The API diffs rather than delete-and-recreate, so account numbers on selections
 * that stay are preserved, and it enforces the N/A exclusivity rule server-side.
 */
export async function setCustomerVendors(
  customerId: number,
  vendorIds: number[]
): Promise<ActionResult> {
  const res = await apiFetch(`/api/customers/${customerId}/vendors`, {
    method: "PUT",
    body: JSON.stringify({ vendorIds }),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Could not reach the API." };
  if (res.status === 403) return { ok: false, error: "You do not have permission to edit this member." };
  if (!res.ok) return { ok: false, error: "Failed to save vendors." };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
