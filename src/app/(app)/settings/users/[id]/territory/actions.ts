"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export type TerritoryState = { error?: string };

export async function setTerritory(
  userId: string,
  _prev: TerritoryState,
  formData: FormData
): Promise<TerritoryState> {
  // Checked states + any comma-separated custom states, normalized to upper-case.
  const checked = formData.getAll("states").map((s) => String(s));
  const custom = String(formData.get("customStates") ?? "")
    .split(",")
    .map((s) => s.trim());
  const states = Array.from(
    new Set([...checked, ...custom].map((s) => s.trim().toUpperCase()).filter(Boolean))
  );

  const res = await apiFetch(`/api/userstategrants/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({ states }),
  }).catch(() => null);

  if (!res) return { error: "Your session has expired. Please sign in again." };
  if (res.status === 403) return { error: "You don't have permission to manage territory access." };
  if (!res.ok) return { error: `Failed to save territory access (${res.status}).` };

  revalidatePath("/settings/users");
  redirect("/settings/users");
}
