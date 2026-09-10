import "server-only";
import { fieldLabel } from "@/lib/report";
import type { AggregateBucket, Bucket2d, Customer, ReportDefinition } from "@/lib/types";

const API = process.env.API_BASE_URL!;

const DEFAULT_COLUMNS = ["memberId", "businessName", "storeCity", "storeState", "status"];

/**
 * Rows fetched for a table export. The API paginates without an upper bound, so this is the
 * ceiling we choose; a report that hits it is truncated, and the caller is told so rather than
 * being handed a silently short file.
 */
export const EXPORT_ROW_LIMIT = 5000;

export function csvCell(value: unknown): string {
  if (value == null) return "";
  let s = String(value);
  // Neutralize spreadsheet formula injection: a customer-controlled field beginning with a
  // formula trigger (= + - @, or a leading tab/CR) executes when the CSV is opened in Excel/
  // Sheets. Prefix with an apostrophe so the cell is treated as text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/** The typed + metadata filter params shared by every report data call. */
function dataParams(def: ReportDefinition): URLSearchParams {
  const p = new URLSearchParams();
  (def.filters ?? []).filter(Boolean).forEach((f) => p.append("filters", f));
  (def.metadataFilters ?? []).filter(Boolean).forEach((f) => p.append("metadataFilters", f));
  return p;
}

export type ReportCsvResult =
  | { ok: true; csv: string; truncated: boolean }
  | { ok: false; status: number; error: string };

/**
 * Render a report definition to CSV.
 *
 * Depends only on the definition, never on a saved preset, which is what lets the same code serve
 * both a saved report and an ad-hoc query.
 */
export async function buildReportCsv(
  def: ReportDefinition,
  auth: Record<string, string>,
): Promise<ReportCsvResult> {
  // Customer <-> Vendor source: let the API render the flat CSV (one row per customer-vendor
  // pair) — it owns the vendor join and the state scoping.
  if (def.source === "customer-vendor") {
    if (!def.vendorCodes?.trim() && !def.vendorGroupNames?.trim()) {
      return { ok: false, status: 400, error: "Select at least one vendor before exporting." };
    }

    const p = new URLSearchParams();
    (def.filters ?? []).filter(Boolean).forEach((f) => p.append("filters", f));
    if (def.vendorCodes?.trim()) p.set("vendorCodes", def.vendorCodes.trim());
    if (def.vendorGroupNames?.trim()) p.set("vendorGroupNames", def.vendorGroupNames.trim());
    p.set("matchAll", String(def.matchAll ?? true));

    const res = await fetch(`${API}/api/reports/customer-vendor/export-flat?${p.toString()}`, {
      headers: auth,
      cache: "no-store",
    }).catch(() => null);

    if (!res?.ok) {
      return { ok: false, status: res?.status ?? 502, error: "Failed to export report." };
    }

    return { ok: true, csv: await res.text(), truncated: false };
  }

  const viz = def.visualization ?? "table";

  if (viz === "table") {
    const p = dataParams(def);
    p.set("pageNumber", "1");
    p.set("pageSize", String(EXPORT_ROW_LIMIT));

    const res = await fetch(`${API}/api/customers?${p.toString()}`, { headers: auth, cache: "no-store" });
    const rows = res.ok ? ((await res.json()) as Customer[]) : [];
    const columns = def.columns?.length ? def.columns : DEFAULT_COLUMNS;

    const csv =
      csvRow(columns.map(fieldLabel)) +
      "\n" +
      rows
        .map((r) => csvRow(columns.map((c) => (r as unknown as Record<string, unknown>)[c])))
        .join("\n");

    return { ok: true, csv, truncated: rows.length >= EXPORT_ROW_LIMIT };
  }

  if (viz === "bar" && def.series) {
    const p = dataParams(def);
    p.set("groupBy", def.groupBy || "status");
    p.set("series", def.series);

    const res = await fetch(`${API}/api/reports/customers/aggregate-2d?${p.toString()}`, {
      headers: auth,
      cache: "no-store",
    });
    const buckets = res.ok ? ((await res.json()) as Bucket2d[]) : [];

    const csv =
      csvRow([fieldLabel(def.groupBy || "status"), fieldLabel(def.series), "count"]) +
      "\n" +
      buckets.flatMap((b) => b.series.map((s) => csvRow([b.key, s.key, s.count]))).join("\n");

    return { ok: true, csv, truncated: false };
  }

  const p = dataParams(def);
  p.set("groupBy", def.groupBy || "status");

  const res = await fetch(`${API}/api/reports/customers/aggregate?${p.toString()}`, {
    headers: auth,
    cache: "no-store",
  });
  const buckets = res.ok ? ((await res.json()) as AggregateBucket[]) : [];

  const csv =
    csvRow([fieldLabel(def.groupBy || "status"), "count"]) +
    "\n" +
    buckets.map((b) => csvRow([b.key, b.count])).join("\n");

  return { ok: true, csv, truncated: false };
}

/** A filesystem-safe CSV attachment header. */
export function csvHeaders(fileName: string, truncated: boolean): Record<string, string> {
  const safe = fileName.replace(/[^\w.\-]+/g, "_") || "report";

  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${safe}.csv"`,
    // Surfaced so the caller can warn rather than hand over a silently short file.
    ...(truncated ? { "X-Export-Truncated": String(EXPORT_ROW_LIMIT) } : {}),
  };
}
