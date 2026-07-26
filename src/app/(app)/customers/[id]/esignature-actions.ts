"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { ActionResult } from "@/app/(app)/customers/[id]/cooler-actions";
import type { EsignatureManualRecipient, SigningSession } from "@/lib/types";

// A result that may carry data (the signing session), mirroring settings/esignature/actions.ts.
type LaunchResult = { ok: true; data: SigningSession } | { ok: false; error: string };

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

/**
 * Start an embedded in-person signing session for an EXISTING document. Returns the short-lived
 * signing url to embed. The url is a credential — it is fetched only on demand and handed to the
 * client just for the iframe.
 */
export async function launchInPersonSigning(
  documentId: number,
  returnUrl?: string
): Promise<LaunchResult> {
  const res = await apiFetch(`/api/esignature-documents/${documentId}/in-person-session`, {
    method: "POST",
    body: JSON.stringify({ returnUrl: returnUrl ?? null }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Could not reach the API." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not start signing.") };
  return { ok: true, data: (await res.json()) as SigningSession };
}

/**
 * One-call "start fresh + sign now": create a draft document from a template for the customer,
 * then immediately mint an in-person signing session.
 */
export async function startInPersonFromTemplate(
  customerId: number,
  templateId: number,
  recipients: EsignatureManualRecipient[],
  returnUrl?: string
): Promise<LaunchResult> {
  const res = await apiFetch(`/api/customers/${customerId}/esignature-documents/in-person`, {
    method: "POST",
    body: JSON.stringify({ templateId, recipients, returnUrl: returnUrl ?? null }),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Could not reach the API." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not start signing.") };
  revalidatePath(`/customers/${customerId}`);
  const body = (await res.json()) as { session: SigningSession };
  return { ok: true, data: body.session };
}
