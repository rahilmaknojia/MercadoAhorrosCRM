import { COOLER_TYPES, type CoolerDocument, type CoolerRow, type MasterDataItem } from "@/lib/types";

/**
 * The versioned cooler / cold-vault site survey (Site Survey → Coolers & Cold Vaults).
 *
 * A survey is the snake_case object the API stores (see the API's SiteSurveySchema): the cooler
 * sections the CRM already had plus the legacy cold-vault, shelf, facing and store fields. Keys
 * match the legacy import, so imported values show up. The API owns the rules — whole-number door
 * counts, decimal shelves/facings, and "# of Cold Vault Doors" as the sum of the four door counts —
 * and the UI mirrors them only for instant feedback.
 *
 * The field layout follows the legacy Edit page's "Cold Vaults" and "Shelves by catagory"
 * fieldsets, column by column, so reps find every field where they are used to it.
 */

export type SurveyStatus = "draft" | "submitted";

export type YesNo = "yes" | "no";

export type SiteSurvey = CoolerDocument & {
  cold_vaults?: CoolerDocument["cold_vaults"] & {
    no_of_store_options_doors?: number;
    no_of_beer_doors?: number;
  };
  shelves?: Record<string, number>;
  facings?: Record<string, number>;
  /** Yes/No answers are "yes"/"no"; older imports stored `true` for Yes. */
  flags?: { cooler_store?: YesNo | true; dry_store?: YesNo | true; space_payment_eligible?: string };
};

export type SurveyVersionSummary = {
  version: number;
  status: SurveyStatus;
  /** "legacy" = the old system's last survey (from the import); "baseline" = data on file before any survey. */
  source: string | null;
  createdOn: string;
  createdBy: string;
  modifiedOn: string | null;
  modifiedBy: string | null;
  submittedOn: string | null;
  submittedBy: string | null;
  /** The zone manager this survey counts for (fixed at submit; moved by a transfer). */
  zoneManagerId: number | null;
  zoneManagerName: string | null;
  /** Submitted by someone other than that zone manager. */
  onBehalf: boolean;
};

export type ZoneManagerRef = { id: number; name: string };

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
  /** Who a submit by the current user counts for by default: their own zone manager, else the member's. */
  defaultZoneManager: ZoneManagerRef | null;
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

const shelf = (key: string, label: string, extra?: Partial<NumberField>): NumberField => ({
  section: "shelves",
  key,
  label,
  ...extra,
});
const facing = (key: string, label: string): NumberField => ({ section: "facings", key, label });

/** Summed into "# of Cold Vault Doors" (legacy `.cooler-count`). */
export const DOOR_FIELDS: NumberField[] = [
  { section: "cold_vaults", key: "no_of_carb_doors", label: "# of Carb Doors", whole: true },
  { section: "cold_vaults", key: "no_of_non_carb_doors", label: "# of Non-Carb Doors", whole: true },
  { section: "cold_vaults", key: "no_of_store_options_doors", label: "# of Store Options Doors", whole: true },
  { section: "cold_vaults", key: "no_of_beer_doors", label: "# of Beer Doors", whole: true },
];

export const YES_NO_FIELDS = [
  { key: "cooler_store", label: "Cooler Store" },
  { key: "dry_store", label: "Dry Store" },
] as const;

export type YesNoKey = (typeof YES_NO_FIELDS)[number]["key"];

/** The legacy dropdown's values, verbatim. */
export const SPACE_PAYMENT_OPTIONS = [
  "Yes",
  "No-Non Compliance",
  "No-Outsourcing",
  "No-Refused Reset",
  "No-Other",
] as const;

/** One cell of the Cold Vaults grid. */
export type ColdVaultItem =
  | { kind: "modified" }
  | { kind: "total" }
  | { kind: "number"; field: NumberField }
  | { kind: "yesno"; key: YesNoKey; label: string }
  | { kind: "spacePayment" };

const num = (field: NumberField): ColdVaultItem => ({ kind: "number", field });

/** The legacy "Cold Vaults" fieldset, as its three columns (top to bottom). */
export const COLD_VAULT_COLUMNS: ColdVaultItem[][] = [
  [{ kind: "modified" }, { kind: "total" }, ...DOOR_FIELDS.map(num), num(shelf("milk", "# of Milk Shelves"))],
  [
    shelf("carb", "# of Carb Shelves", { hint: CARB_SHELVES_HINT }),
    shelf("non_carb", "# of Non-Carb Shelves", { hint: NON_CARB_SHELVES_HINT }),
    shelf("redbull", "# of Redbull Shelves"),
    shelf("monster", "# of Monster Shelves"),
    shelf("gatorade", "# of Gatorade Shelves"),
    facing("body_armour", "# of Body Armour Facings"),
    facing("uptime", "# of Uptime Facings"),
    shelf("no_of_20oz_csd_facing", "# of 20oz Facing in Shelf", { whole: true }),
  ].map(num),
  [
    num(facing("arizona", "# of Arizona Facings")),
    num(facing("nesquick", "# of Nesquick Facings")),
    num(facing("bang", "# of Bang Facings")),
    ...YES_NO_FIELDS.map((f): ColdVaultItem => ({ kind: "yesno", key: f.key, label: f.label })),
    { kind: "spacePayment" },
    num(shelf("shelves_in_door", "Shelves In Door", { whole: true })),
  ],
];

/** The legacy "Shelves by catagory" fieldset, as its three columns. */
export const CATEGORY_COLUMNS: NumberField[][] = [
  [
    shelf("energy", "Energy Shelves"),
    shelf("functional_energy", "Functional Energy Shelves"),
    shelf("fit_energy", "Fit Energy Shelves"),
    shelf("isotonics", "Isotonics Shelves"),
  ],
  [
    shelf("water", "Water Shelves"),
    shelf("enhanced_water", "Enhanced Water Shelves"),
    shelf("tea", "Tea Shelves"),
    shelf("coffee", "Coffee Shelves"),
  ],
  [
    shelf("protein", "Protein Shelves"),
    shelf("juice", "Juice Shelves (Incl Juice Drinks)"),
    shelf("dairy", "Dairy Shelves"),
    shelf("store_option", "# of Store Option Shelves"),
  ],
];

/** Every number field, in legacy order (column by column). */
export const NUMBER_FIELDS: NumberField[] = [
  ...COLD_VAULT_COLUMNS.flat().flatMap((item) => (item.kind === "number" ? [item.field] : [])),
  ...CATEGORY_COLUMNS.flat(),
];

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
  flags: [...YES_NO_FIELDS.map((f) => f.key), "space_payment_eligible"],
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

/**
 * Keep only what a field accepts while typing: digits for whole numbers (legacy stripped
 * everything else on keyup), digits and one decimal point otherwise.
 */
export function sanitizeCount(raw: string, whole: boolean | undefined): string {
  if (whole) return raw.replace(/\D/g, "");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

const yesNoOf = (v: unknown): YesNo | "" => {
  if (v === true) return "yes";
  if (v === false) return "no";
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "yes" || s === "true") return "yes";
    if (s === "no" || s === "false") return "no";
  }
  return "";
};

// ---- form state ---------------------------------------------------------------------------------

export type SurveyForm = {
  rows: CoolerRow[];
  sharedSelected: string[];
  sharedNotes: string;
  /** Keyed by fieldId; raw input text. */
  numbers: Record<string, string>;
  /** A legacy total with no door breakdown, kept for display until doors are entered. */
  legacyTotal: number | undefined;
  yesNo: Record<YesNoKey, YesNo | "">;
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
    yesNo: { cooler_store: yesNoOf(survey.flags?.cooler_store), dry_store: yesNoOf(survey.flags?.dry_store) },
    spacePayment: survey.flags?.space_payment_eligible ?? "",
  };
}

/** The door counts that are filled in, for the "1 + 0 + 2 + 2" breakdown. */
export function doorParts(form: SurveyForm): number[] {
  return DOOR_FIELDS.map((f) => form.numbers[fieldId(f)]?.trim() ?? "")
    .filter((raw) => raw !== "" && !Number.isNaN(Number(raw)))
    .map(Number);
}

/** "# of Cold Vault Doors": the door sum once any door is entered, else a stored legacy total. */
export function coldVaultTotal(form: SurveyForm): number | undefined {
  const parts = doorParts(form);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : form.legacyTotal;
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
  if (form.legacyTotal !== undefined && doorParts(form).length === 0) {
    (survey.cold_vaults ??= {}).no_of_cold_vault = form.legacyTotal;
  }

  const flags: NonNullable<SiteSurvey["flags"]> = {};
  for (const { key } of YES_NO_FIELDS) if (form.yesNo[key]) flags[key] = form.yesNo[key] as YesNo;
  if (form.spacePayment) flags.space_payment_eligible = form.spacePayment;
  if (Object.keys(flags).length) survey.flags = flags;

  return errors.length ? { errors } : { survey };
}

/**
 * Every editable value of the form keyed by a stable id, so the editor can mark fields that
 * differ from where the edit started.
 */
export function formValues(form: SurveyForm): Record<string, string> {
  const out: Record<string, string> = { ...form.numbers };
  for (const { key } of COOLER_TYPES) {
    out[`coolers.${key}`] = form.rows
      .filter((r) => r.coolerType === key)
      .map((r) => `${r.brand}:${r.package}`)
      .sort()
      .join(",");
  }
  out.shared_coolers = [...form.sharedSelected].sort().join(",");
  out.shared_notes = form.sharedNotes.trim();
  for (const { key } of YES_NO_FIELDS) out[`flags.${key}`] = form.yesNo[key];
  out["flags.space_payment_eligible"] = form.spacePayment;
  return out;
}

/** Ids whose value differs between two forms (numbers compared numerically, so "1" = "1.0"). */
export function changedIds(start: SurveyForm, current: SurveyForm): Set<string> {
  const a = formValues(start);
  const b = formValues(current);
  const same = (x = "", y = "") => x === y || (x.trim() !== "" && y.trim() !== "" && Number(x) === Number(y));
  return new Set(Object.keys(b).filter((id) => !same(a[id], b[id])));
}

// ---- display ------------------------------------------------------------------------------------

export const labelOf = (items: MasterDataItem[], code: string) => items.find((i) => i.code === code)?.name ?? code;

export const yesNoLabel = (v: YesNo | "") => (v === "yes" ? "Yes" : v === "no" ? "No" : "");

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

/** Every recorded value of a survey as label → display text, in legacy layout order. For diffs. */
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

  for (const item of COLD_VAULT_COLUMNS.flat()) {
    if (item.kind === "total") {
      const total = survey.cold_vaults?.no_of_cold_vault;
      if (total !== undefined) out.set("# of Cold Vault Doors", formatCount(total));
    } else if (item.kind === "number") {
      const v = numberOf(survey, item.field);
      if (v !== undefined) out.set(item.field.label, formatCount(v));
    } else if (item.kind === "yesno") {
      if (form.yesNo[item.key]) out.set(item.label, yesNoLabel(form.yesNo[item.key]));
    } else if (item.kind === "spacePayment") {
      if (form.spacePayment) out.set("Space Payment Eligible", form.spacePayment);
    }
  }
  for (const f of CATEGORY_COLUMNS.flat()) {
    const v = numberOf(survey, f);
    if (v !== undefined) out.set(f.label, formatCount(v));
  }
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
