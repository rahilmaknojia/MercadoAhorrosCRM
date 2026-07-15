"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { CoolerRow } from "@/lib/types";

export type ActionResult = { ok: boolean; error?: string };

export type CoolerSectionInput = {
  rows: CoolerRow[];
  sharedNotes: string;
  sharedSelected: string[];
  coldVaults: {
    no_of_cold_vault: string;
    no_of_carb_doors: string;
    no_of_non_carb_doors: string;
  };
};

/**
 * Writes the cooler/shared-cooler/cold-vault sections of a customer's StoreMetadata.
 *
 * Uses PATCH by-customer, which merges server-side at the top level: it replaces exactly the
 * keys below and cannot clobber a concurrent write to another section (notably the photo
 * gallery's __photoCaptions, which lives in the same document).
 *
 * This function is the writer, so it owns the document invariants:
 *  - I1 present implies true — never emit `false`/`null`. A stored null is jsonb null, not SQL
 *    NULL, so `exists` (which is `-> 'k' IS NOT NULL`) would match every store.
 *  - I2 prune empty objects — a bare `{ mid_size: {} }` would make coolers.mid_size|exists true.
 *  - I4 counts are numbers, so gte/between (which cast ::numeric) work.
 *
 * Note each section is replaced wholesale, so omitting a row/key removes it. A section that
 * becomes empty is written as `{}` rather than removed, because a `||` merge can add and replace
 * keys but not delete them. That only makes the meaningless container query (`coolers|exists`)
 * true; the queries that matter (coolers.<type>.<brand>[.<package>]) stay exact.
 */
export async function saveCoolerSection(
  customerId: number,
  input: CoolerSectionInput
): Promise<ActionResult> {
  const coolers: Record<string, Record<string, Record<string, true>>> = {};
  for (const row of input.rows) {
    if (!row.coolerType || !row.brand || !row.package) continue;
    const byBrand = (coolers[row.coolerType] ??= {});
    const packages = (byBrand[row.brand] ??= {});
    packages[row.package] = true; // I1
  }
  for (const [type, byBrand] of Object.entries(coolers)) {
    if (Object.keys(byBrand).length === 0) delete coolers[type]; // I2
  }

  const selected: Record<string, true> = {};
  for (const code of input.sharedSelected) {
    if (code) selected[code] = true; // I1
  }
  const sharedCoolers: Record<string, unknown> = {};
  if (input.sharedNotes.trim()) sharedCoolers.notes = input.sharedNotes.trim();
  if (Object.keys(selected).length) sharedCoolers.selected = selected; // I2

  const coldVaults: Record<string, number> = {};
  for (const [key, raw] of Object.entries(input.coldVaults)) {
    const value = Number(raw);
    // I4: numbers only. Blank means "not recorded"; negatives are rejected as nonsense.
    if (raw.trim() === "" || !Number.isFinite(value)) continue;
    if (value < 0) return { ok: false, error: "Cold vault counts cannot be negative." };
    coldVaults[key] = value;
  }

  const res = await apiFetch(`/api/storemetadata/by-customer/${customerId}`, {
    method: "PATCH",
    body: JSON.stringify({
      jsonData: JSON.stringify({
        coolers,
        shared_coolers: sharedCoolers,
        cold_vaults: coldVaults,
      }),
    }),
  }).catch(() => null);

  if (!res) return { ok: false, error: "Could not reach the API." };
  if (res.status === 403) return { ok: false, error: "You do not have permission to edit this member." };
  if (!res.ok) return { ok: false, error: "Failed to save coolers." };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
