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

// Fields available for filtering / table columns.
export const CUSTOMER_FIELDS = [
  { value: "memberId", label: "Member ID" },
  { value: "businessName", label: "Business name" },
  { value: "contactName", label: "Contact name" },
  { value: "storeCity", label: "City" },
  { value: "storeState", label: "State" },
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

export function fieldLabel(value: string): string {
  return CUSTOMER_FIELDS.find((f) => f.value === value)?.label ?? value;
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
