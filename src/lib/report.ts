import type { AggregateBucket, Bucket2d, Customer, ReportDefinition } from "@/lib/types";

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
