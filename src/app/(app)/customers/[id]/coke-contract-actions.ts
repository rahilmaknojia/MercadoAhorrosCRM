"use server";

import { revalidatePath } from "next/cache";
import { patchStoreMetadata } from "@/lib/metadata/patch";
import { toCokeContractSection, type CokeContractInput } from "@/lib/metadata/coke-contract";
import { MetadataValueError } from "@/lib/metadata/sections";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Writes the whole `coke_contract` section (the server merge is shallow, so the section is always
 * sent complete; an all-empty contract is sent as `{}`).
 */
export async function saveCokeContract(
  customerId: number,
  input: CokeContractInput
): Promise<ActionResult> {
  let contract;
  try {
    contract = toCokeContractSection(input);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof MetadataValueError && e.reason === "negative"
          ? "Rack counts cannot be negative."
          : "Rack counts must be whole numbers.",
    };
  }

  const res = await patchStoreMetadata(customerId, { coke_contract: contract }, "Failed to save the Coke contract.");
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath(`/customers/${customerId}`);
  return { ok: true };
}
