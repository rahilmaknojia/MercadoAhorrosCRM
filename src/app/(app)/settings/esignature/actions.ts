"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type {
  EsignatureAvailableTemplate,
  EsignatureTemplateMapping,
} from "@/lib/types";

export type EsignResult<T = undefined> = { ok: boolean; error?: string; data?: T };

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 403) return "You don't have permission to manage eSignature templates.";
  const body = (await res.json().catch(() => null)) as { message?: string; upstream?: string } | null;
  return body?.message ?? fallback;
}

/** NinjaFlow templates available to onboard. */
export async function getAvailableTemplates(): Promise<EsignResult<EsignatureAvailableTemplate[]>> {
  const res = await apiFetch("/api/esignature-templates/available").catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not load NinjaFlow templates.") };
  return { ok: true, data: (await res.json()) as EsignatureAvailableTemplate[] };
}

/** Roles + merge tokens for one NinjaFlow template, to drive the mapping builder. */
export async function getAvailableTemplateDetail(
  externalTemplateId: string
): Promise<EsignResult<EsignatureAvailableTemplate>> {
  const res = await apiFetch(
    `/api/esignature-templates/available/${encodeURIComponent(externalTemplateId)}`
  ).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not load the template.") };
  return { ok: true, data: (await res.json()) as EsignatureAvailableTemplate };
}

type TemplateInput = {
  externalTemplateId: string;
  name: string;
  description?: string | null;
  tag?: string | null;
  isActive: boolean;
  mapping: EsignatureTemplateMapping;
};

export async function createEsignatureTemplate(input: TemplateInput): Promise<EsignResult> {
  const res = await apiFetch("/api/esignature-templates", {
    method: "POST",
    body: JSON.stringify(input),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not save the template.") };
  revalidatePath("/settings/esignature");
  return { ok: true };
}

export async function updateEsignatureTemplate(
  id: number,
  input: Omit<TemplateInput, "externalTemplateId">
): Promise<EsignResult> {
  const res = await apiFetch(`/api/esignature-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not update the template.") };
  revalidatePath("/settings/esignature");
  return { ok: true };
}

export async function deleteEsignatureTemplate(id: number): Promise<EsignResult> {
  const res = await apiFetch(`/api/esignature-templates/${id}`, { method: "DELETE" }).catch(() => null);
  if (!res) return { ok: false, error: "Network error." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not delete the template.") };
  revalidatePath("/settings/esignature");
  return { ok: true };
}
