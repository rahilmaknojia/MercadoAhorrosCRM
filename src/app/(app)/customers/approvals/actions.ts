"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export async function approveMember(id: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/customers/${id}/approve`, { method: "POST" }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (res.status === 403) return { ok: false, error: "You don't have permission to approve members." };
  if (!res.ok) return { ok: false, error: `Failed to approve (${res.status}).` };
  revalidatePath("/customers/approvals");
  revalidatePath("/customers");
  return { ok: true };
}
