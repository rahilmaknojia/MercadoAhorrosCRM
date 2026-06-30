"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

// Captions are stashed inside the customer's StoreMetadata JSON under this reserved
// key, as a map of photo-source-key -> caption text.
const CAPTIONS_KEY = "__photoCaptions";

// Fire-and-forget audit entry for photo activity (upload/delete). Writes a
// CustomerLog via the API; failures are swallowed so auditing never blocks the UI.
export async function logPhotoActivity(customerId: number, message: string): Promise<void> {
  if (!customerId || !message.trim()) return;
  await apiFetch("/api/customerlogs", {
    method: "POST",
    body: JSON.stringify({ customerId, message: message.trim() }),
  }).catch(() => null);
}

// Upsert a single photo caption into the customer's StoreMetadata JSON. Reads the
// current row, merges the caption under the reserved key, and writes the full blob
// back (PUT if a row exists, else POST). Empty caption removes it.
export async function savePhotoCaption(
  customerId: number,
  photoKey: string,
  caption: string
): Promise<{ ok: boolean; error?: string }> {
  if (!customerId || !photoKey) return { ok: false, error: "Missing photo." };

  const res = await apiFetch(
    `/api/storemetadata?filters=customerId|exact|${customerId}&pageSize=1`
  ).catch(() => null);
  if (!res?.ok) return { ok: false, error: "Could not load store metadata." };

  const rows = (await res.json().catch(() => [])) as Array<{ id: number; jsonData?: string | null }>;
  const existing = Array.isArray(rows) ? rows[0] : undefined;

  let data: Record<string, unknown> = {};
  if (existing?.jsonData) {
    try {
      data = JSON.parse(existing.jsonData) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  const captions: Record<string, string> = { ...((data[CAPTIONS_KEY] as Record<string, string>) ?? {}) };
  const text = caption.trim();
  if (text) captions[photoKey] = text;
  else delete captions[photoKey];
  if (Object.keys(captions).length) data[CAPTIONS_KEY] = captions;
  else delete data[CAPTIONS_KEY];

  const body = JSON.stringify({ customerId, jsonData: JSON.stringify(data) });
  const write = existing?.id
    ? await apiFetch(`/api/storemetadata/${existing.id}`, { method: "PUT", body }).catch(() => null)
    : await apiFetch("/api/storemetadata", { method: "POST", body }).catch(() => null);

  if (!write?.ok) {
    return {
      ok: false,
      error: write?.status === 403 ? "You don't have permission to edit captions." : "Failed to save caption.",
    };
  }
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
