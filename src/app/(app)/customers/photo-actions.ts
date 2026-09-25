"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { patchStoreMetadata } from "@/lib/metadata/patch";

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

// Upsert a single photo caption. Only the `__photoCaptions` key is written, through PATCH
// by-customer (a server-side top-level merge), so a caption save can never overwrite another
// section of the document the way the old whole-document read-modify-write + PUT could.
//
// The caption map is still read first so the other photos' captions are carried over; two people
// captioning different photos of the same member at the same instant could lose one caption, but
// never anything outside the map. Empty caption removes it; an emptied map is written as `{}`
// (a `||` merge cannot delete a key).
export async function savePhotoCaption(
  customerId: number,
  photoKey: string,
  caption: string
): Promise<{ ok: boolean; error?: string }> {
  if (!customerId || !photoKey) return { ok: false, error: "Missing photo." };

  const res = await apiFetch(`/api/storemetadata/by-customer/${customerId}`).catch(() => null);
  // 404 = no document yet, which is simply "no captions".
  if (!res || (!res.ok && res.status !== 404)) {
    return { ok: false, error: "Could not load store metadata." };
  }

  let captions: Record<string, string> = {};
  if (res.ok) {
    const row = (await res.json().catch(() => null)) as { jsonData?: string | null } | null;
    try {
      const data = row?.jsonData ? (JSON.parse(row.jsonData) as Record<string, unknown>) : {};
      const stored = data[CAPTIONS_KEY];
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        captions = { ...(stored as Record<string, string>) };
      }
    } catch {
      captions = {};
    }
  }

  const text = caption.trim();
  if (text) captions[photoKey] = text;
  else delete captions[photoKey];

  const write = await patchStoreMetadata(customerId, { [CAPTIONS_KEY]: captions }, "Failed to save caption.");
  if (!write.ok) {
    return {
      ok: false,
      error: write.status === 403 ? "You don't have permission to edit captions." : write.error,
    };
  }
  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
