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
