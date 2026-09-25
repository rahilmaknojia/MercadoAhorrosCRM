import { count, flag, section, type SectionObject } from "@/lib/metadata/sections";

/**
 * The `coke_contract` section of a customer's StoreMetadata (spec §1): six display flags and ten
 * rack counts. Flags are true-or-absent; counts are non-negative integers, absent when blank
 * (0 is a real, stored answer). Written whole through PATCH by-customer.
 */

export const COKE_DISPLAYS = [
  { key: "twelve_pack_display", label: "12 pack display" },
  { key: "two_liter_display", label: "2 liter display" },
  { key: "glass_bottle_single_import_rack", label: "Glass bottle single import rack" },
  { key: "topo_chico_take_home_display", label: "Topo Chico take-home display" },
  { key: "hydration_rack_or_display", label: "Hydration rack or display" },
  // Stored as a flag meaning "cold equipment NEEDED" — the legacy PDF prints Need / Do Not Need.
  { key: "cold_equipment", label: "Cold equipment", on: "Needed", off: "Not needed" },
] as const;

/** Legacy letter badges A–J, in the order the legacy form printed them. */
export const COKE_RACKS = [
  { key: "two_liter_racks_for_under_meat_counter", letter: "A", label: "2 liter racks for under meat counter" },
  { key: "small_import_rack", letter: "B", label: "Small import rack" },
  { key: "small_topo_chico_rack", letter: "C", label: "Small Topo Chico rack" },
  { key: "two_liter_table_hold_bread_produce_items", letter: "D", label: "2 liter table (holds bread / produce items)" },
  { key: "can_pet_size_table_with_bread", letter: "E", label: "Can / PET size table with bread" },
  { key: "small_import_rack_holds_10cs_f", letter: "F", label: "Small import rack, holds 10 cs" },
  { key: "small_import_rack_holds_10cs_g", letter: "G", label: "Small import rack, holds 10 cs" },
  { key: "hydration_rack_20cs", letter: "H", label: "Hydration rack, 20 cs" },
  { key: "rack_10cs", letter: "I", label: "10 cs rack" },
  { key: "rack_20cs", letter: "J", label: "20 cs rack" },
] as const;

export type CokeDisplayKey = (typeof COKE_DISPLAYS)[number]["key"];
export type CokeRackKey = (typeof COKE_RACKS)[number]["key"];

/** The stored section. */
export type CokeContract = Partial<Record<CokeDisplayKey, true> & Record<CokeRackKey, number>>;

/** The editor's state: toggles, and counts as the raw input text ("" = not recorded). */
export type CokeContractInput = {
  displays: Partial<Record<CokeDisplayKey, boolean>>;
  racks: Partial<Record<CokeRackKey, string>>;
};

/** Stored section → editor state. Tolerates junk in the document (it is shown, not trusted). */
export function fromCokeContract(doc: unknown): CokeContractInput {
  const src = doc && typeof doc === "object" && !Array.isArray(doc) ? (doc as Record<string, unknown>) : {};
  const displays: CokeContractInput["displays"] = {};
  for (const { key } of COKE_DISPLAYS) if (src[key] === true) displays[key] = true;
  const racks: CokeContractInput["racks"] = {};
  for (const { key } of COKE_RACKS) {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v)) racks[key] = String(v);
  }
  return { displays, racks };
}

/**
 * Editor state → the section to write. Pure; throws MetadataValueError for a negative or
 * fractional count. An all-empty contract comes back as `{}` (written as-is; see sections.ts).
 */
export function toCokeContractSection(input: CokeContractInput): SectionObject {
  const draft: Record<string, true | number | undefined> = {};
  for (const { key } of COKE_DISPLAYS) draft[key] = flag(input.displays[key]);
  for (const { key } of COKE_RACKS) draft[key] = count(input.racks[key]);
  return section(draft);
}

/** "4 of 6 displays · 23 racks" — the card header summary. */
export function summarizeCokeContract(input: CokeContractInput): string {
  const displays = COKE_DISPLAYS.filter(({ key }) => input.displays[key]).length;
  let racks = 0;
  let anyRack = false;
  for (const { key } of COKE_RACKS) {
    const raw = input.racks[key]?.trim();
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      racks += n;
      anyRack = true;
    }
  }
  if (!displays && !anyRack) return "Nothing recorded";
  return `${displays} of ${COKE_DISPLAYS.length} displays · ${racks} rack${racks === 1 ? "" : "s"}`;
}
