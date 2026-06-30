"use server";

import { apiFetch } from "@/lib/server/api";

// Fire-and-forget audit entry for photo activity (upload/delete). Writes a
// CustomerLog via the API; failures are swallowed so auditing never blocks the UI.
export async function logPhotoActivity(customerId: number, message: string): Promise<void> {
  if (!customerId || !message.trim()) return;
  await apiFetch("/api/customerlogs", {
    method: "POST",
    body: JSON.stringify({ customerId, message: message.trim() }),
  }).catch(() => null);
}
