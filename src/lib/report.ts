import type {
  AggregateBucket,
  Bucket2d,
  Customer,
  ReportDefinition,
  VendorGroup,
  VendorReportItem,
} from "@/lib/types";

// Report data sources (what the report queries over).
export const REPORT_SOURCES = [
  { value: "customers", label: "Customers" },
  { value: "customer-vendor", label: "Customer ↔ Vendor" },
] as const;

// Fields available for filtering / table columns. This is the single source of curated
// wording — the report builder, report tables, CSV export, and the customer filter builder
// all label columns from here so the same field never reads two different ways.
export const CUSTOMER_FIELDS = [
  { value: "memberId", label: "Member ID" },
  { value: "businessName", label: "Business name" },
  { value: "contactName", label: "Contact name" },
  { value: "storeAddress", label: "Store address" },
  { value: "storeCity", label: "City" },
  { value: "storeState", label: "State" },
  { value: "storeZipcode", label: "ZIP" },
  { value: "status", label: "Status" },
  { value: "region", label: "Region" },
  { value: "district", label: "District" },
  { value: "zoneManager", label: "Zone manager" },
  { value: "storeGroup", label: "Store group" },
  { value: "email", label: "Email" },
  { value: "storePhone", label: "Phone" },
] as const;

// Operators supported by the API's typed dynamic filter (EntityQueryExtensions).
export const FILTER_OPERATORS = [
  { value: "exact", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "startswith", label: "starts with" },
] as const;

// Operators supported by StoreMetadata JSONB filters (StoreMetadataSqlFilter).
// "exists" is the canonical operator for slug-keyed sets like coolers, where the answer is
// encoded by the key being present at all (e.g. coolers.standing.coke|exists). It takes no value.
export const METADATA_OPERATORS = [
  { value: "exists", label: "is present" },
  { value: "eq", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less or equal" },
] as const;

/** Operators that ignore the value input (the clause is just path|operator). */
export const VALUELESS_METADATA_OPERATORS: readonly string[] = ["exists"];

// Handy starting points for the metadata path input. The cooler document is slug-keyed
// (coolers.<type>.<brandCode>.<packageCode>), so brand/package codes are appended by the user.
export const COOLER_METADATA_PATHS = [
  { value: "coolers.standing", label: "Standing cooler brands" },
  { value: "coolers.counter_top", label: "Counter-top cooler brands" },
  { value: "coolers.mid_size", label: "Mid-size cooler brands" },
  { value: "cold_vaults.no_of_cold_vault", label: "Cold vault count" },
  { value: "cold_vaults.no_of_carb_doors", label: "Carbonated door count" },
  { value: "cold_vaults.no_of_non_carb_doors", label: "Non-carbonated door count" },
  { value: "shared_coolers.notes", label: "Shared cooler notes" },
] as const;

// Fields the API can group by (mirrors CustomerService.GroupableFields).
export const GROUP_FIELDS = [
  { value: "status", label: "Status" },
  { value: "storeState", label: "State" },
  { value: "storeCity", label: "City" },
  { value: "region", label: "Region" },
  { value: "district", label: "District" },
  { value: "zoneManager", label: "Zone manager" },
  { value: "storeGroup", label: "Store group" },
  { value: "dateJoined", label: "Date joined (by month)" },
  { value: "createdOn", label: "Created (by month)" },
] as const;

// Tokens that must not be title-cased word-by-word. Keyed by the lowercased token
// so the humanizer can look them up after splitting.
const LABEL_ACRONYMS: Record<string, string> = {
  id: "ID",
  ids: "IDs",
  zip: "ZIP",
  url: "URL",
  no: "No.",
  ncb: "NCB",
  pos: "POS",
  kdp: "KDP",
  atm: "ATM",
};

// Kept lowercase mid-header, e.g. `no_of_carb_doors` → "No. of Carb Doors".
const LABEL_MINOR_WORDS = new Set([
  "of",
  "and",
  "or",
  "the",
  "a",
  "an",
  "in",
  "on",
  "at",
  "to",
  "for",
  "by",
]);

/**
 * Turn a raw API field name into a human header: `businessAddress` → "Business Address",
 * `storeZipcode` → "Store Zipcode", `federalTaxId` → "Federal Tax ID".
 *
 * Handles camelCase, snake_case, kebab-case, and dotted JSON metadata paths, so a column
 * the CUSTOMER_FIELDS table has never heard of still gets a readable header instead of
 * leaking the database column name into a report.
 */
export function humanizeField(value: string): string {
  const leaf = value.includes(":") ? value.slice(value.indexOf(":") + 1) : value;

  return leaf
    .split(".")
    .map((segment) =>
      segment
        // split camelCase / PascalCase, keeping acronym runs intact (taxID → tax ID)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, index) => {
          const lower = word.toLowerCase();
          const known = LABEL_ACRONYMS[lower];
          if (known) return known;
          // Minor words stay lowercase unless they lead the segment.
          if (index > 0 && LABEL_MINOR_WORDS.has(lower)) return lower;
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" "),
    )
    .filter(Boolean)
    .join(" › ");
}

/**
 * Display label for a field. Prefers the curated CUSTOMER_FIELDS wording, and falls back
 * to humanizing the raw name — never to the raw name itself.
 */
export function fieldLabel(value: string): string {
  return (
    CUSTOMER_FIELDS.find((f) => f.value === value)?.label ?? humanizeField(value)
  );
}

// Short label for the report-kind badge.
export function vizLabel(def: ReportDefinition): string {
  if (def.source === "customer-vendor") return "vendor list";
  return def.visualization ?? "table";
}

// The API stores the report definition as a JSON string (jsonb). Parse defensively.
export function parseDefinition(raw: unknown): ReportDefinition {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ReportDefinition;
    } catch {
      return {};
    }
  }
  return (raw as ReportDefinition) ?? {};
}

function buildParams(def: ReportDefinition): URLSearchParams {
  const p = new URLSearchParams();
  (def.filters ?? []).filter(Boolean).forEach((f) => p.append("filters", f));
  (def.metadataFilters ?? []).filter(Boolean).forEach((f) => p.append("metadataFilters", f));
  return p;
}

export async function fetchTable(
  def: ReportDefinition
): Promise<{ rows: Customer[]; total: number }> {
  const p = buildParams(def);
  p.set("pageNumber", "1");
  p.set("pageSize", "100");
  if (def.sortField) {
    p.set("sortField", def.sortField);
    p.set("ascending", String(def.ascending ?? true));
  }
  const res = await fetch(`/api/report-data/customers?${p.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to run report (${res.status}).`);
  const rows = (await res.json()) as Customer[];
  const header = res.headers.get("x-pagination");
  const total = header ? (JSON.parse(header).TotalCount as number) : rows.length;
  return { rows: Array.isArray(rows) ? rows : [], total };
}

export async function fetchAggregate(def: ReportDefinition): Promise<AggregateBucket[]> {
  const p = buildParams(def);
  p.set("groupBy", def.groupBy || "status");
  const res = await fetch(`/api/report-data/reports/customers/aggregate?${p.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to run report (${res.status}).`);
  return (await res.json()) as AggregateBucket[];
}

export async function fetchAggregate2d(def: ReportDefinition): Promise<Bucket2d[]> {
  const p = buildParams(def);
  p.set("groupBy", def.groupBy || "status");
  p.set("series", def.series || "status");
  const res = await fetch(`/api/report-data/reports/customers/aggregate-2d?${p.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to run report (${res.status}).`);
  return (await res.json()) as Bucket2d[];
}

// --- Customer ↔ Vendor source ---

// The vendor report endpoint takes customer field filters plus vendor selectors.
export function hasVendorSelection(def: ReportDefinition): boolean {
  return !!def.vendorCodes?.trim() || !!def.vendorGroupNames?.trim();
}

export function buildVendorParams(def: ReportDefinition): URLSearchParams {
  const p = new URLSearchParams();
  (def.filters ?? []).filter(Boolean).forEach((f) => p.append("filters", f));
  if (def.vendorCodes?.trim()) p.set("vendorCodes", def.vendorCodes.trim());
  if (def.vendorGroupNames?.trim()) p.set("vendorGroupNames", def.vendorGroupNames.trim());
  p.set("matchAll", String(def.matchAll ?? true));
  return p;
}

export async function fetchVendorReport(
  def: ReportDefinition
): Promise<{ rows: VendorReportItem[]; total: number }> {
  const p = buildVendorParams(def);
  p.set("pageNumber", "1");
  p.set("pageSize", "100");
  if (def.sortField) {
    p.set("sortField", def.sortField);
    p.set("ascending", String(def.ascending ?? true));
  }
  const res = await fetch(`/api/report-data/reports/customer-vendor?${p.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to run report (${res.status}).`);
  const rows = (await res.json()) as VendorReportItem[];
  const header = res.headers.get("x-pagination");
  const total = header ? (JSON.parse(header).TotalCount as number) : rows.length;
  return { rows: Array.isArray(rows) ? rows : [], total };
}

// Load the grouped vendor catalogue for the builder's vendor picker.
export async function fetchVendorGroups(): Promise<VendorGroup[]> {
  const res = await fetch(`/api/report-data/vendors/grouped`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load vendors (${res.status}).`);
  const groups = (await res.json()) as VendorGroup[];
  return Array.isArray(groups) ? groups : [];
}
