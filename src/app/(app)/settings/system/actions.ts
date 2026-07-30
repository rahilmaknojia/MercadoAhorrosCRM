"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export type SettingResult = { ok: boolean; error?: string };

export async function setSetting(key: string, value: string): Promise<SettingResult> {
  const res = await apiFetch(`/api/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Network error." };
  if (res.status === 403) return { ok: false, error: "Only the owner can change system settings." };
  if (!res.ok) return { ok: false, error: "Could not save the setting." };

  revalidatePath("/settings/system");
  return { ok: true };
}
