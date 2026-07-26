"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { ActionResult } from "@/app/(app)/customers/[id]/cooler-actions";
import type { EsignatureManualRecipient } from "@/lib/types";

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 403) return "You don't have permission to send documents.";
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}

/** Raise a signing envelope for a customer from a registered template. */
export async function sendEsignatureDocument(
  customerId: number,
  templateId: number,
  recipients: EsignatureManualRecipient[],
  sendImmediately: boolean
): Promise<ActionResult> {
  const res = await apiFetch(`/api/customers/${customerId}/esignature-documents`, {
    method: "POST",
    body: JSON.stringify({ templateId, recipients, sendImmediately }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Could not reach the API." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not create the document.") };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}

/** Re-sync one document's status from NinjaFlow. */
export async function refreshEsignatureDocument(
  customerId: number,
  documentId: number
): Promise<ActionResult> {
  const res = await apiFetch(`/api/esignature-documents/${documentId}/refresh`, {
    method: "POST",
  }).catch(() => null);
  if (!res) return { ok: false, error: "Could not reach the API." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not refresh status.") };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
