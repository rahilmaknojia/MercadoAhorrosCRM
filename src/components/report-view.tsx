"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchAggregate,
  fetchAggregate2d,
  fetchTable,
  fetchVendorReport,
  fieldLabel,
  hasVendorSelection,
} from "@/lib/report";
import type {
  AggregateBucket,
  Bucket2d,
  Customer,
  ReportDefinition,
  VendorReportItem,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const COLORS = [
  "#e11d2e",
  "#ffb000",
  "#1f9d55",
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

const DEFAULT_COLUMNS = ["memberId", "businessName", "storeCity", "storeState", "status"];

const DATE_GROUP_FIELDS = new Set(["dateJoined", "createdOn"]);

// Dispatch on the report source. Each branch renders a self-contained component
// with its own hooks, so switching source (e.g. in the builder) is a normal
// conditional render — not a conditional hook.
export function ReportView({ definition }: { definition: ReportDefinition }) {
  if (definition.source === "customer-vendor") {
    return <VendorReportTable definition={definition} />;
  }
  return <CustomerReportView definition={definition} />;
}

function CustomerReportView({ definition }: { definition: ReportDefinition }) {
  const router = useRouter();
  const viz = definition.visualization ?? "table";

  // Build a drill-through link to the filtered customer list for a clicked segment.
  // Skipped for date buckets (can't eq-filter a month) and the "(none)" bucket.
  function drillTo(groupKey: string, seriesKey?: string) {
    const gb = definition.groupBy;
    if (!gb || DATE_GROUP_FIELDS.has(gb) || groupKey === "(none)") return;
    const p = new URLSearchParams();
    (definition.filters ?? []).forEach((f) => p.append("filters", f));
    p.append("filters", `${gb}|exact|${groupKey}`);
    if (seriesKey && definition.series && seriesKey !== "(none)") {
      p.append("filters", `${definition.series}|exact|${seriesKey}`);
    }
    (definition.metadataFilters ?? []).forEach((f) => p.append("meta", f));
    router.push(`/customers?${p.toString()}`);
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [buckets, setBuckets] = useState<AggregateBucket[]>([]);
  const [buckets2d, setBuckets2d] = useState<Bucket2d[]>([]);

  const isStacked = viz === "bar" && !!definition.series;

  // Re-run whenever the definition changes.
  const key = JSON.stringify(definition);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (viz === "table") {
          const res = await fetchTable(definition);
          if (!active) return;
          setRows(res.rows);
          setTotal(res.total);
        } else if (isStacked) {
          const b = await fetchAggregate2d(definition);
          if (!active) return;
          setBuckets2d(b);
        } else {
          const b = await fetchAggregate(definition);
          if (!active) return;
          setBuckets(b);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, viz]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" /> Running report…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (viz === "metric") {
    const sum = buckets.reduce((t, b) => t + b.count, 0);
    return (
      <div className="rounded-lg border p-6">
        <div className="text-4xl font-semibold tabular-nums">{sum.toLocaleString()}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          matching records{definition.groupBy ? ` · grouped by ${fieldLabel(definition.groupBy)}` : ""}
        </div>
      </div>
    );
  }

  if (isStacked) {
    if (buckets2d.length === 0) {
      return <p className="text-sm text-muted-foreground">No data for this report.</p>;
    }
    const seriesKeys = Array.from(new Set(buckets2d.flatMap((b) => b.series.map((s) => s.key))));
    const data = buckets2d.map((b) => {
      const row: Record<string, string | number> = { name: b.key };
      for (const k of seriesKeys) row[k] = b.series.find((s) => s.key === k)?.count ?? 0;
      return row;
    });
    return (
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {seriesKeys.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="a"
                fill={COLORS[i % COLORS.length]}
                cursor="pointer"
                onClick={(d) => drillTo(String((d as { name?: string }).name ?? ""), k)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (viz === "bar" || viz === "pie") {
    if (buckets.length === 0) {
      return <p className="text-sm text-muted-foreground">No data for this report.</p>;
    }
    const data = buckets.map((b) => ({ name: b.key, value: b.count }));
    return (
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {viz === "bar" ? (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(d) => drillTo(String((d as { name?: string }).name ?? ""))}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <PieChart>
              <Tooltip />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                outerRadius={120}
                label
                cursor="pointer"
                onClick={(d) => drillTo(String((d as { name?: string }).name ?? ""))}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }

  // Table
  const columns = definition.columns?.length ? definition.columns : DEFAULT_COLUMNS;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{total} matching record(s)</p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c}>{fieldLabel(c)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No matching records.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  {columns.map((c) => {
                    const v = (r as unknown as Record<string, unknown>)[c];
                    return <TableCell key={c}>{v == null || v === "" ? "—" : String(v)}</TableCell>;
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Customer ↔ Vendor report: one row per customer with their selected vendors.
function VendorReportTable({ definition }: { definition: ReportDefinition }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VendorReportItem[]>([]);
  const [total, setTotal] = useState(0);

  // The API requires at least one vendor selector; guide the user otherwise.
  const hasSelection = hasVendorSelection(definition);

  const key = JSON.stringify(definition);
  useEffect(() => {
    // No selection → the render guard below shows guidance; nothing to fetch.
    if (!hasSelection) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetchVendorReport(definition);
        if (!active) return;
        setRows(res.rows);
        setTotal(res.total);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hasSelection]);

  if (!hasSelection) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Select at least one vendor to run this report.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" /> Running report…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{total} matching customer(s)</p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member ID</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Selected vendors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No matching customers.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.customerId}
                  className="cursor-pointer"
                  onClick={() => router.push(`/customers/${r.customerId}`)}
                >
                  <TableCell className="font-medium">{r.memberId}</TableCell>
                  <TableCell>{r.businessName || r.contactName || "—"}</TableCell>
                  <TableCell>{r.storeCity || "—"}</TableCell>
                  <TableCell>{r.storeState || "—"}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>
                    {r.selectedVendors.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.selectedVendors.map((v) => (
                          <Badge key={v.vendorId} variant="secondary" title={v.groupName}>
                            {v.name}
                            {v.accountNumber ? ` · ${v.accountNumber}` : ""}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
