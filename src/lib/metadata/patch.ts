import "server-only";
import { apiFetch } from "@/lib/server/api";
import {
  isReservedMetadataKey,
  METADATA_KEY_PATTERN,
  metadataViolations,
} from "@/lib/metadata/sections";

export type PatchResult = { ok: true } | { ok: false; status: number | null; error: string };

/**
 * Writes whole top-level sections of a customer's StoreMetadata document through
 * PATCH /api/storemetadata/by-customer/{id}.
 *
 * The API merges with `JsonData || patch` in a single statement (creating the row when absent),
 * so only the keys sent are replaced and a concurrent write to another section cannot be lost.
 * This is the only way the CRM should write the document — never read-modify-write the whole
 * thing and PUT it back.
 *
 * Every non-reserved key is checked against the JSONB invariants first (see ./sections.ts);
 * reserved `__*` keys (photo captions, signature-on-file) are app-internal blobs and are exempt.
 * `fallbackError` is the message for an unexpected upstream failure.
 */
export async function patchStoreMetadata(
  customerId: number,
  sections: Record<string, unknown>,
  fallbackError = "Failed to save.",
): Promise<PatchResult> {
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return { ok: false, status: null, error: "Missing customer." };
  }
  const keys = Object.keys(sections);
  if (keys.length === 0) return { ok: true };

  const violations = keys.flatMap((key) =>
    !METADATA_KEY_PATTERN.test(key)
      ? [`${key}: invalid key`]
      : isReservedMetadataKey(key)
        ? []
        : metadataViolations(sections[key], key),
  );
  if (violations.length) {
    // A programming error, not user input — say so plainly rather than writing bad data.
    return { ok: false, status: null, error: `Refusing to write invalid metadata (${violations.join("; ")}).` };
  }

  const res = await apiFetch(`/api/storemetadata/by-customer/${customerId}`, {
    method: "PATCH",
    body: JSON.stringify({ jsonData: JSON.stringify(sections) }),
  }).catch(() => null);

  if (!res) return { ok: false, status: null, error: "Could not reach the API." };
  if (res.ok) return { ok: true };
  if (res.status === 403) {
    return { ok: false, status: 403, error: "You do not have permission to edit this member." };
  }
  if (res.status === 404) return { ok: false, status: 404, error: "Member not found." };
  if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, status: 400, error: body?.message ?? fallbackError };
  }
  return { ok: false, status: res.status, error: fallbackError };
}
