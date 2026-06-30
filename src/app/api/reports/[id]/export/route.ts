import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";
import { parseDefinition, fieldLabel } from "@/lib/report";
import type { AggregateBucket, Bucket2d, Customer, ReportPreset } from "@/lib/types";

const API = process.env.API_BASE_URL!;
const DEFAULT_COLUMNS = ["memberId", "businessName", "storeCity", "storeState", "status"];

function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

// Build the typed/metadata filter params shared by all report data calls.
function dataParams(def: ReturnType<typeof parseDefinition>): URLSearchParams {
  const p = new URLSearchParams();
  (def.filters ?? []).filter(Boolean).forEach((f) => p.append("filters", f));
  (def.metadataFilters ?? []).filter(Boolean).forEach((f) => p.append("metadataFilters", f));
  return p;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jwt = await getJwt(req.headers.get("cookie"));
  if (!jwt) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const auth = { Authorization: `Bearer ${jwt}` };

  const presetRes = await fetch(`${API}/api/reportpresets/${id}`, { headers: auth, cache: "no-store" }).catch(
    () => null
  );
  if (!presetRes?.ok) {
    return NextResponse.json({ error: "Report not found" }, { status: presetRes?.status ?? 404 });
  }
  const preset = (await presetRes.json()) as ReportPreset;
  const def = parseDefinition(preset.queryParameters);
  const safeName = preset.name.replace(/[^\w.\-]+/g, "_");

  // Customer ↔ Vendor source: let the API render the flat CSV (one row per
  // customer-vendor pair) — it owns the vendor join and state scoping.
  if (def.source === "customer-vendor") {
    if (!def.vendorCodes?.trim() && !def.vendorGroupNames?.trim()) {
      return NextResponse.json(
        { error: "Select at least one vendor before exporting." },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Failed to export report." }, { status: res?.status ?? 502 });
    }
    return new NextResponse(await res.text(), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.csv"`,
      },
    });
  }

  const viz = def.visualization ?? "table";

  let csv = "";
  if (viz === "table") {
    const p = dataParams(def);
    p.set("pageNumber", "1");
    p.set("pageSize", "5000");
    const res = await fetch(`${API}/api/customers?${p.toString()}`, { headers: auth, cache: "no-store" });
    const rows = res.ok ? ((await res.json()) as Customer[]) : [];
    const columns = def.columns?.length ? def.columns : DEFAULT_COLUMNS;
    csv =
      csvRow(columns.map(fieldLabel)) +
      "\n" +
      rows.map((r) => csvRow(columns.map((c) => (r as unknown as Record<string, unknown>)[c]))).join("\n");
  } else if (viz === "bar" && def.series) {
    const p = dataParams(def);
    p.set("groupBy", def.groupBy || "status");
    p.set("series", def.series);
    const res = await fetch(`${API}/api/reports/customers/aggregate-2d?${p.toString()}`, {
      headers: auth,
      cache: "no-store",
    });
    const buckets = res.ok ? ((await res.json()) as Bucket2d[]) : [];
    csv =
      csvRow([fieldLabel(def.groupBy || "status"), fieldLabel(def.series), "count"]) +
      "\n" +
      buckets.flatMap((b) => b.series.map((s) => csvRow([b.key, s.key, s.count]))).join("\n");
  } else {
    const p = dataParams(def);
    p.set("groupBy", def.groupBy || "status");
    const res = await fetch(`${API}/api/reports/customers/aggregate?${p.toString()}`, {
      headers: auth,
      cache: "no-store",
    });
    const buckets = res.ok ? ((await res.json()) as AggregateBucket[]) : [];
    csv =
      csvRow([fieldLabel(def.groupBy || "status"), "count"]) +
      "\n" +
      buckets.map((b) => csvRow([b.key, b.count])).join("\n");
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
    },
  });
}
