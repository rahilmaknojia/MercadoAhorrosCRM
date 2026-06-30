"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import type { ReportDefinition, ReportPreset } from "@/lib/types";

export type SaveReportPayload = {
  id?: number;
  name: string;
  description?: string;
  definition: ReportDefinition;
};

export type SaveResult = { ok: boolean; error?: string; id?: number };

export async function saveReport(payload: SaveReportPayload): Promise<SaveResult> {
  const name = payload.name.trim();
  if (!name) return { ok: false, error: "A report name is required." };

  const body = {
    name,
    description: payload.description?.trim() || null,
    queryParameters: payload.definition,
  };

  const path = payload.id ? `/api/reportpresets/${payload.id}` : "/api/reportpresets";
  const res = await apiFetch(path, {
    method: payload.id ? "PUT" : "POST",
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (res.status === 403) return { ok: false, error: "You don't have permission to save reports." };
  if (res.status === 409) return { ok: false, error: "A report with that name already exists." };
  if (!res.ok) return { ok: false, error: `Failed to save report (${res.status}).` };

  const saved = (await res.json().catch(() => null)) as ReportPreset | null;
  revalidatePath("/reports");
  return { ok: true, id: saved?.id ?? payload.id };
}

export async function deleteReport(id: number): Promise<void> {
  await apiFetch(`/api/reportpresets/${id}`, { method: "DELETE" }).catch(() => null);
  revalidatePath("/reports");
  redirect("/reports");
}

export async function setPinned(id: number, pinned: boolean): Promise<void> {
  // Fetch the current preset, flip the pin flag, and save it back.
  const res = await apiFetch(`/api/reportpresets/${id}`).catch(() => null);
  if (!res?.ok) return;
  const preset = (await res.json()) as ReportPreset;
  const definition: ReportDefinition = { ...preset.queryParameters, pinnedToDashboard: pinned };
  await apiFetch(`/api/reportpresets/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: preset.name,
      description: preset.description ?? null,
      queryParameters: definition,
    }),
  }).catch(() => null);
  revalidatePath("/reports");
  revalidatePath("/");
}
