"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { ActionResult } from "@/app/(app)/customers/[id]/cooler-actions";
import type { EsignatureManualRecipient, SigningSession } from "@/lib/types";

// A result that may carry data (the signing session + which document it belongs to, so the caller
// can re-sync that document's status after the session closes).
type LaunchData = { session: SigningSession; documentId: number };
type LaunchResult = { ok: true; data: LaunchData } | { ok: false; error: string };

async function readError(res: Response, fallback: string): Promise<string> {
  // Prefer the API's own message — it relays upstream (NinjaFlow) 4xx bodies, so a 403 here is
  // not necessarily a permission problem. Only fall back to the permission wording for a bodyless 403.
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  if (body?.message) return body.message;
  if (res.status === 403) return "You don't have permission to do that.";
  return fallback;
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
  return { ok: true, data: { session: (await res.json()) as SigningSession, documentId } };
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
  const body = (await res.json()) as { session: SigningSession; document: { id: number } };
  return { ok: true, data: { session: body.session, documentId: body.document.id } };
}

/** Remove a tracked document (local cleanup — does not void the NinjaFlow envelope). */
export async function deleteEsignatureDocument(
  customerId: number,
  documentId: number
): Promise<ActionResult> {
  const res = await apiFetch(`/api/esignature-documents/${documentId}`, {
    method: "DELETE",
  }).catch(() => null);
  if (!res) return { ok: false, error: "Could not reach the API." };
  if (!res.ok) return { ok: false, error: await readError(res, "Could not delete the document.") };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
