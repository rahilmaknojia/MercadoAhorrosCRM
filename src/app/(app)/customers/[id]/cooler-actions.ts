"use server";

import { revalidatePath } from "next/cache";
import { patchStoreMetadata } from "@/lib/metadata/patch";
import { count, flag, flagSet, MetadataValueError, section, text } from "@/lib/metadata/sections";
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
 * Goes through `patchStoreMetadata` (PATCH by-customer, a server-side top-level merge), so it
 * replaces exactly these three keys and cannot clobber a concurrent write to another section.
 * The section builders own the document invariants (true-or-absent, pruned empties, integer
 * counts) — see src/lib/metadata/sections.ts.
 *
 * Each section is replaced wholesale, so omitting a row/key removes it; a section that becomes
 * empty is written as `{}` (a `||` merge cannot delete keys).
 */
export async function saveCoolerSection(
  customerId: number,
  input: CoolerSectionInput
): Promise<ActionResult> {
  const coolers: Record<string, Record<string, Record<string, true | undefined>>> = {};
  for (const row of input.rows) {
    if (!row.coolerType || !row.brand || !row.package) continue;
    const byBrand = (coolers[row.coolerType] ??= {});
    (byBrand[row.brand] ??= {})[row.package] = flag(true);
  }

  let coldVaults: Record<string, number | undefined>;
  try {
    coldVaults = Object.fromEntries(
      Object.entries(input.coldVaults).map(([key, raw]) => [key, count(raw)])
    );
  } catch (e) {
    if (e instanceof MetadataValueError && e.reason === "negative") {
      return { ok: false, error: "Cold vault counts cannot be negative." };
    }
    return { ok: false, error: "Cold vault counts must be whole numbers." };
  }

  const res = await patchStoreMetadata(
    customerId,
    {
      coolers: section(coolers),
      shared_coolers: section({
        notes: text(input.sharedNotes),
        selected: flagSet(input.sharedSelected),
      }),
      cold_vaults: section(coldVaults),
    },
    "Failed to save coolers."
  );
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
