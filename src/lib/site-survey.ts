import { COOLER_TYPES, type CoolerDocument, type CoolerRow, type MasterDataItem } from "@/lib/types";

/**
 * The versioned cooler / cold-vault site survey (Site Survey → Coolers & Cold Vaults).
 *
 * A survey is the snake_case object the API stores (see the API's SiteSurveySchema): the cooler
 * sections the CRM already had plus the legacy cold-vault, shelf, facing and store fields. Keys
 * match the legacy import, so imported values show up. The API owns the rules — whole-number door
 * counts, decimal shelves/facings, and "# of Cold Vault Doors" as the sum of the four door counts —
 * and the UI mirrors them only for instant feedback.
 */

export type SurveyStatus = "draft" | "submitted";

export type SiteSurvey = CoolerDocument & {
  cold_vaults?: CoolerDocument["cold_vaults"] & {
    no_of_store_options_doors?: number;
    no_of_beer_doors?: number;
  };
  shelves?: Record<string, number>;
  facings?: Record<string, number>;
  flags?: { cooler_store?: true; dry_store?: true; space_payment_eligible?: string };
};

export type SurveyVersionSummary = {
  version: number;
  status: SurveyStatus;
  /** "baseline" = the data that existed (usually imported) before the first survey version. */
  source: string | null;
  createdOn: string;
  createdBy: string;
  modifiedOn: string | null;
  modifiedBy: string | null;
  submittedOn: string | null;
  submittedBy: string | null;
};

export type SurveyVersion = { summary: SurveyVersionSummary; survey: SiteSurvey };

export type SurveyOverview = {
  draft: SurveyVersion | null;
  /** What is in effect now (the member's StoreMetadata), including imported data. */
  live: SiteSurvey;
  /** Newest version number; send back as `expectedVersion`. */
  headVersion: number | null;
  coolerModifiedOn: string | null;
  /** Newest first. */
  history: SurveyVersionSummary[];
};

// ---- fields -----------------------------------------------------------------------------------

export type NumberSection = "cold_vaults" | "shelves" | "facings";

export type NumberField = {
  section: NumberSection;
  key: string;
  label: string;
  /** Whole numbers only (door counts and the legacy int columns); otherwise up to 2 decimals. */
  whole?: boolean;
  hint?: string;
};

/**
 * Explanations behind the legacy info icons. Legacy loaded this wording from an admin-editable
 * table that was not migrated — replace with the original text when it is available.
 */
export const CARB_SHELVES_HINT = "Shelves of carbonated drinks (sodas, sparkling) in the cold vault.";
export const NON_CARB_SHELVES_HINT =
  "Shelves of non-carbonated drinks (water, juice, tea, sports and energy drinks) in the cold vault.";

/** Summed into "# of Cold Vault Doors". */
export const DOOR_FIELDS: NumberField[] = [
  { section: "cold_vaults", key: "no_of_carb_doors", label: "# of Carb Doors", whole: true },
  { section: "cold_vaults", key: "no_of_non_carb_doors", label: "# of Non-Carb Doors", whole: true },
  { section: "cold_vaults", key: "no_of_store_options_doors", label: "# of Store Options Doors", whole: true },
  { section: "cold_vaults", key: "no_of_beer_doors", label: "# of Beer Doors", whole: true },
];

export const SHELF_FIELDS: NumberField[] = [
  { section: "shelves", key: "milk", label: "# of Milk Shelves" },
  { section: "shelves", key: "carb", label: "# of Carb Shelves", hint: CARB_SHELVES_HINT },
  { section: "shelves", key: "non_carb", label: "# of Non-Carb Shelves", hint: NON_CARB_SHELVES_HINT },
  { section: "shelves", key: "redbull", label: "# of Redbull Shelves" },
  { section: "shelves", key: "monster", label: "# of Monster Shelves" },
  { section: "shelves", key: "gatorade", label: "# of Gatorade Shelves" },
  { section: "facings", key: "body_armour", label: "# of Body Armour Facings" },
  { section: "facings", key: "uptime", label: "# of Uptime Facings" },
  { section: "shelves", key: "no_of_20oz_csd_facing", label: "# of 20oz Facing in Shelf", whole: true },
  { section: "facings", key: "arizona", label: "# of Arizona Facings" },
  { section: "facings", key: "nesquick", label: "# of Nesquick Facings" },
  { section: "facings", key: "bang", label: "# of Bang Facings" },
  { section: "shelves", key: "shelves_in_door", label: "Shelves In Door", whole: true },
];

export const CATEGORY_FIELDS: NumberField[] = [
  { section: "shelves", key: "energy", label: "Energy Shelves" },
  { section: "shelves", key: "functional_energy", label: "Functional Energy Shelves" },
  { section: "shelves", key: "fit_energy", label: "Fit Energy Shelves" },
  { section: "shelves", key: "isotonics", label: "Isotonics Shelves" },
  { section: "shelves", key: "water", label: "Water Shelves" },
  { section: "shelves", key: "enhanced_water", label: "Enhanced Water Shelves" },
  { section: "shelves", key: "tea", label: "Tea Shelves" },
  { section: "shelves", key: "coffee", label: "Coffee Shelves" },
  { section: "shelves", key: "protein", label: "Protein Shelves" },
  { section: "shelves", key: "juice", label: "Juice Shelves (Incl Juice Drinks)" },
  { section: "shelves", key: "dairy", label: "Dairy Shelves" },
  { section: "shelves", key: "store_option", label: "# of Store Option Shelves" },
];

export const NUMBER_FIELDS = [...DOOR_FIELDS, ...SHELF_FIELDS, ...CATEGORY_FIELDS];

export const YES_FLAGS = [
  { key: "cooler_store", label: "Cooler Store" },
  { key: "dry_store", label: "Dry Store" },
] as const;

export type YesFlagKey = (typeof YES_FLAGS)[number]["key"];

/** The legacy dropdown's values, verbatim. */
export const SPACE_PAYMENT_OPTIONS = ["Yes", "No-Other", "No-Outsourcing"] as const;

/**
 * Keys the survey owns inside sections it shares with other imported fields (`facings.jarritos`,
 * `flags.donation_box`, the rest of `store_profile`). Used to hide them from the raw metadata view.
 */
export const SURVEY_OWNED_KEYS: Record<string, string[]> = {
  shelves: [
    ...NUMBER_FIELDS.filter((f) => f.section === "shelves").map((f) => f.key),
    // Door counts the legacy import filed under shelves; the survey moves them to cold_vaults.
    "no_of_beers",
    "no_of_store_options",
  ],
  facings: NUMBER_FIELDS.filter((f) => f.section === "facings").map((f) => f.key),
  flags: [...YES_FLAGS.map((f) => f.key), "space_payment_eligible"],
  store_profile: ["cooler_modified"],
};

export const fieldId = (f: NumberField) => `${f.section}.${f.key}`;

export function numberOf(survey: SiteSurvey, f: NumberField): number | undefined {
  const section = survey[f.section] as Record<string, number | undefined> | undefined;
  const v = section?.[f.key];
  return typeof v === "number" ? v : undefined;
}

/** 12 → "12", 12.5 → "12.5" — never "12.00" (legacy requirement). */
export function formatCount(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "";
  return String(Math.round(v * 100) / 100);
}

// ---- form state ---------------------------------------------------------------------------------

export type SurveyForm = {
  rows: CoolerRow[];
  sharedSelected: string[];
  sharedNotes: string;
  /** Keyed by fieldId; raw input text. */
  numbers: Record<string, string>;
  /** A legacy total with no door breakdown, kept for display until doors are entered. */
  legacyTotal: number | undefined;
  flags: Record<YesFlagKey, boolean>;
  spacePayment: string;
};

export function toForm(survey: SiteSurvey): SurveyForm {
  const rows: CoolerRow[] = [];
  for (const { key } of COOLER_TYPES) {
    for (const [brand, packages] of Object.entries(survey.coolers?.[key] ?? {})) {
      for (const pkg of Object.keys(packages ?? {})) rows.push({ coolerType: key, brand, package: pkg });
    }
  }

  const numbers: Record<string, string> = {};
  for (const f of NUMBER_FIELDS) numbers[fieldId(f)] = formatCount(numberOf(survey, f));

  const hasDoors = DOOR_FIELDS.some((f) => numberOf(survey, f) !== undefined);
  return {
    rows,
    sharedSelected: Object.keys(survey.shared_coolers?.selected ?? {}),
    sharedNotes: survey.shared_coolers?.notes ?? "",
    numbers,
    legacyTotal: hasDoors ? undefined : survey.cold_vaults?.no_of_cold_vault,
    flags: { cooler_store: !!survey.flags?.cooler_store, dry_store: !!survey.flags?.dry_store },
    spacePayment: survey.flags?.space_payment_eligible ?? "",
  };
}

/** "# of Cold Vault Doors": the door sum once any door is entered, else a stored legacy total. */
export function coldVaultTotal(form: SurveyForm): number | undefined {
  let total: number | undefined;
  for (const f of DOOR_FIELDS) {
    const raw = form.numbers[fieldId(f)]?.trim();
    const n = raw ? Number(raw) : NaN;
    if (!Number.isNaN(n)) total = (total ?? 0) + n;
  }
  return total ?? form.legacyTotal;
}

/** Build the survey to send, or the list of problems to fix first. */
export function fromForm(form: SurveyForm): { survey: SiteSurvey } | { errors: string[] } {
  const errors: string[] = [];
  const survey: SiteSurvey = {};

  const coolers: NonNullable<SiteSurvey["coolers"]> = {};
  for (const row of form.rows) {
    if (!row.brand || !row.package) continue;
    const type = (coolers[row.coolerType] ??= {});
    (type[row.brand] ??= {})[row.package] = true;
  }
  if (Object.keys(coolers).length) survey.coolers = coolers;

  const notes = form.sharedNotes.trim();
  if (form.sharedSelected.length || notes) {
    survey.shared_coolers = {
      ...(notes ? { notes } : {}),
      ...(form.sharedSelected.length
        ? { selected: Object.fromEntries(form.sharedSelected.map((c) => [c, true as const])) }
        : {}),
    };
  }

  for (const f of NUMBER_FIELDS) {
    const raw = form.numbers[fieldId(f)]?.trim();
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isNaN(n)) errors.push(`${f.label} must be a number.`);
    else if (n < 0) errors.push(`${f.label} cannot be negative.`);
    else if (f.whole && !Number.isInteger(n)) errors.push(`${f.label} must be a whole number.`);
    else ((survey[f.section] ??= {}) as Record<string, number>)[f.key] = n;
  }

  // Keep a legacy total that has no door breakdown (the API does the same).
  if (form.legacyTotal !== undefined && !DOOR_FIELDS.some((f) => form.numbers[fieldId(f)]?.trim())) {
    (survey.cold_vaults ??= {}).no_of_cold_vault = form.legacyTotal;
  }

  const flags: NonNullable<SiteSurvey["flags"]> = {};
  for (const { key } of YES_FLAGS) if (form.flags[key]) flags[key] = true;
  if (form.spacePayment) flags.space_payment_eligible = form.spacePayment;
  if (Object.keys(flags).length) survey.flags = flags;

  return errors.length ? { errors } : { survey };
}

// ---- display ------------------------------------------------------------------------------------

export const labelOf = (items: MasterDataItem[], code: string) => items.find((i) => i.code === code)?.name ?? code;

/** A date-only (`2026-09-29`) or UTC date-time string, for display. */
export function formatSurveyDate(value: string | null | undefined, withTime = true): string {
  if (!value) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(dateOnly ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return dateOnly || !withTime
    ? d.toLocaleDateString(undefined, { dateStyle: "medium" })
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export type Catalogues = { brands: MasterDataItem[]; packages: MasterDataItem[]; sharedCoolers: MasterDataItem[] };

/** Every recorded value of a survey as label → display text, in form order. For diffs. */
export function describeSurvey(survey: SiteSurvey, catalogues: Catalogues): Map<string, string> {
  const out = new Map<string, string>();
  const form = toForm(survey);

  for (const { key, label } of COOLER_TYPES) {
    const rows = form.rows
      .filter((r) => r.coolerType === key)
      .map((r) => `${labelOf(catalogues.brands, r.brand)} · ${labelOf(catalogues.packages, r.package)}`);
    if (rows.length) out.set(label, rows.join(", "));
  }
  if (form.sharedSelected.length) {
    out.set("Shared coolers", form.sharedSelected.map((c) => labelOf(catalogues.sharedCoolers, c)).join(", "));
  }
  if (form.sharedNotes) out.set("Shared cooler notes", form.sharedNotes);

  const total = survey.cold_vaults?.no_of_cold_vault;
  if (total !== undefined) out.set("# of Cold Vault Doors", formatCount(total));
  for (const f of NUMBER_FIELDS) {
    const v = numberOf(survey, f);
    if (v !== undefined) out.set(f.label, formatCount(v));
  }
  for (const { key, label } of YES_FLAGS) if (form.flags[key]) out.set(label, "Yes");
  if (form.spacePayment) out.set("Space Payment Eligible", form.spacePayment);
  return out;
}

export type SurveyChange = { label: string; before: string; after: string };

/** What changed from `before` to `after` ("—" for blank). */
export function diffSurveys(before: SiteSurvey, after: SiteSurvey, catalogues: Catalogues): SurveyChange[] {
  const a = describeSurvey(before, catalogues);
  const b = describeSurvey(after, catalogues);
  const labels = [...new Set([...b.keys(), ...a.keys()])];
  return labels
    .filter((l) => a.get(l) !== b.get(l))
    .map((label) => ({ label, before: a.get(label) ?? "—", after: b.get(label) ?? "—" }));
}
