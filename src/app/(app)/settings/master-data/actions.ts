"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { MasterDataItem } from "@/lib/types";

export type MdResult = { ok: boolean; error?: string };

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 403) return "You don't have permission to manage master data.";
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

export async function createMasterDataItem(type: string, name: string): Promise<MdResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  const res = await apiFetch("/api/masterdata", {
    method: "POST",
    body: JSON.stringify({ type, name: trimmed, displayOrder: 0, isActive: true }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not add item.") };
  revalidatePath("/settings/master-data");
  return { ok: true };
}

export async function updateMasterDataItem(item: MasterDataItem): Promise<MdResult> {
  const res = await apiFetch(`/api/masterdata/${item.id}`, {
    method: "PUT",
    body: JSON.stringify({
      type: item.type,
      name: item.name.trim(),
      displayOrder: item.displayOrder,
      isActive: item.isActive,
    }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not update item.") };
  revalidatePath("/settings/master-data");
  return { ok: true };
}

export async function deleteMasterDataItem(id: number): Promise<MdResult> {
  const res = await apiFetch(`/api/masterdata/${id}`, { method: "DELETE" }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not delete item.") };
  revalidatePath("/settings/master-data");
  return { ok: true };
}

// Fold `sourceId` into `targetId`: linked customers are repointed to the target,
// then the source is deleted.
export async function mergeMasterDataItem(sourceId: number, targetId: number): Promise<MdResult> {
  const res = await apiFetch(`/api/masterdata/${sourceId}/merge?into=${targetId}`, {
    method: "POST",
  }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not merge item.") };
  revalidatePath("/settings/master-data");
  return { ok: true };
}

/** Link the user who is this zone manager (null unlinks), so their surveys are credited to them. */
export async function linkZoneManagerUser(
  zoneManagerId: number,
  user: { id: string; name: string; email: string } | null
): Promise<MdResult> {
  const res = await apiFetch(`/api/zone-managers/${zoneManagerId}/linked-user`, {
    method: "PUT",
    body: JSON.stringify({ userId: user?.id ?? null, name: user?.name ?? null, email: user?.email ?? null }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not link the user.") };
  revalidatePath("/settings/master-data");
  return { ok: true };
}

export type ZoneManagerTransfer = {
  toZoneManagerId: number;
  surveys: boolean;
  members: boolean;
  deactivateSource: boolean;
};

export type ZoneManagerTransferResult = { surveysMoved: number; membersMoved: number; sourceDeactivated: boolean };

/** Hand a zone manager's survey credit and/or members to another (e.g. they left). Owner/Admin. */
export async function transferZoneManager(
  fromId: number,
  transfer: ZoneManagerTransfer
): Promise<MdResult & { data?: ZoneManagerTransferResult }> {
  const res = await apiFetch(`/api/zone-managers/${fromId}/transfer`, {
    method: "POST",
    body: JSON.stringify(transfer),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (res.status === 403) return { ok: false, error: "Only an owner or admin can transfer a zone manager's surveys." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not transfer.") };
  revalidatePath("/settings/master-data");
  return { ok: true, data: (await res.json()) as ZoneManagerTransferResult };
}
