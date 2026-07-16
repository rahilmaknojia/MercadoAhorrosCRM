"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AggregateBucket } from "@/lib/types";
import { COLORS } from "@/components/report-view";
import { cn, formatMonthKey } from "@/lib/utils";

type Kind = "donut" | "bar" | "barh";

/**
 * A small dashboard chart over aggregate buckets.
 *  - "donut": pie with a hole + a labelled legend/count list beside it.
 *  - "bar":   vertical bars (use for time series, many buckets).
 *  - "barh":  horizontal bars (use for a handful of named categories).
 */
export function AggregateChart({
  title,
  data,
  kind,
  className,
  formatKey,
  color,
}: {
  title: string;
  data: AggregateBucket[];
  kind: Kind;
  className?: string;
  /** How to render bucket keys as labels. Serializable so it can cross the server->client boundary. */
  formatKey?: "month";
  color?: string;
}) {
  const fmt = formatKey === "month" ? formatMonthKey : (k: string) => k;
  const rows = data.map((b) => ({ ...b, label: fmt(b.key || "(none)") }));
  const total = rows.reduce((t, r) => t + r.count, 0);
  const barColor = color ?? COLORS[0];

  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-xs", className)}>
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h3>

      {rows.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          No data
        </div>
      ) : kind === "donut" ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative size-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="count" nameKey="label" innerRadius={52} outerRadius={72} paddingAngle={2}>
                  {rows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--card)" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{total.toLocaleString()}</span>
              <span className="text-[11px] text-muted-foreground">total</span>
            </div>
          </div>
          <ul className="flex-1 space-y-1.5 text-sm">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="flex-1 truncate">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">{r.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : kind === "barh" ? (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="count" fill={barColor} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ left: -16, right: 8, top: 4, bottom: 0 }}>
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                minTickGap={16}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="count" fill={barColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
