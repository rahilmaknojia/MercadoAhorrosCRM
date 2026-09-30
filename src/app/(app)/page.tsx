import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { AccessSummary } from "@/components/access-summary";
import { ReportView } from "@/components/report-view";
import { StatCard } from "@/components/dashboard/stat-card";
import { AggregateChart } from "@/components/dashboard/aggregate-chart";
import { apiFetch } from "@/lib/server/api";
import { parseDefinition } from "@/lib/report";
import type { AggregateBucket, ReportDefinition, ReportPreset } from "@/lib/types";
import type { ZoneManagerWorklist } from "@/lib/survey-worklist";
import { BarChart3, ClipboardCheck, CircleCheck, CircleMinus, Clock, TrendingUp, Users } from "lucide-react";

async function getPinnedReports(): Promise<{ id: number; name: string; def: ReportDefinition }[]> {
  try {
    const res = await apiFetch("/api/reportpresets?pageNumber=1&pageSize=200");
    if (!res.ok) return [];
    const presets = (await res.json()) as ReportPreset[];
    return presets
      .map((p) => ({ id: p.id, name: p.name, def: parseDefinition(p.queryParameters) }))
      .filter((p) => p.def.pinnedToDashboard);
  } catch {
    return [];
  }
}

// Grouped customer counts for the overview. Behind the ReportsRead policy, so any failure (incl. a
// viewer without reports access) yields [] and the overview simply hides.
async function getAggregate(groupBy: string): Promise<AggregateBucket[]> {
  try {
    const res = await apiFetch(`/api/reports/customers/aggregate?groupBy=${encodeURIComponent(groupBy)}`);
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body) ? (body as AggregateBucket[]) : [];
  } catch {
    return [];
  }
}

/** The signed-in zone manager's survey progress this year; null when they aren't a linked zone manager. */
async function getMySurveys(): Promise<ZoneManagerWorklist | null> {
  try {
    const res = await apiFetch("/api/site-surveys/mine");
    if (!res.ok) return null;
    const body = (await res.json()) as ZoneManagerWorklist;
    return body.zoneManagerId === null ? null : body;
  } catch {
    return null;
  }
}

const bucketValue = (buckets: AggregateBucket[], key: string): number =>
  buckets.find((b) => b.key.toLowerCase() === key.toLowerCase())?.count ?? 0;

export default async function DashboardPage() {
  const [pinned, statusBuckets, districtBuckets, regionBuckets, monthBuckets, mySurveys] = await Promise.all([
    getPinnedReports(),
    getAggregate("status"),
    getAggregate("district"),
    getAggregate("region"),
    getAggregate("dateJoined"),
    getMySurveys(),
  ]);

  const total = statusBuckets.reduce((t, b) => t + b.count, 0);
  const currentMonth = new Date().toISOString().slice(0, 7); // yyyy-MM (UTC, matches the API buckets)
  const newThisMonth = bucketValue(monthBuckets, currentMonth);
  const hasOverview = statusBuckets.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to the Mercado Ahorros CRM.</p>
      </div>

      {mySurveys && (
        <Link
          href="/surveys"
          className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/30"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              Your surveys {mySurveys.year}: {mySurveys.totals.completed} of {mySurveys.totals.members} members done
            </div>
            <div className="text-sm text-muted-foreground">
              {mySurveys.totals.notStarted + mySurveys.totals.inProgress > 0
                ? `${mySurveys.totals.notStarted + mySurveys.totals.inProgress} still to survey this year`
                : "Every member surveyed this year"}
              {" · "}
              {mySurveys.totals.recommendedMet} surveyed twice (recommended)
            </div>
          </div>
          <div className="w-40">
            <div className="text-right text-sm font-semibold tabular-nums">{mySurveys.totals.completionRate}%</div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${mySurveys.totals.completionRate}%` }} />
            </div>
          </div>
        </Link>
      )}

      {hasOverview && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Total members" value={total.toLocaleString()} icon={Users} />
            <StatCard
              label="Active"
              value={bucketValue(statusBuckets, "Active").toLocaleString()}
              icon={CircleCheck}
              iconClassName="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Pending"
              value={bucketValue(statusBuckets, "Pending").toLocaleString()}
              icon={Clock}
              iconClassName="bg-amber-50 text-amber-600"
            />
            <StatCard
              label="Inactive"
              value={bucketValue(statusBuckets, "Inactive").toLocaleString()}
              icon={CircleMinus}
              iconClassName="bg-zinc-100 text-zinc-500"
            />
            <StatCard
              label="New this month"
              value={newThisMonth.toLocaleString()}
              icon={TrendingUp}
              iconClassName="bg-primary/10 text-primary"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AggregateChart
              title="Members by status"
              kind="donut"
              data={statusBuckets}
              colorMap={{ active: "#16a34a", pending: "#f59e0b", inactive: "#dc2626" }}
            />
            <AggregateChart title="Signups by month" kind="bar" data={monthBuckets} formatKey="month" />
            <AggregateChart title="Members by district" kind="barh" data={districtBuckets} />
            <AggregateChart title="Members by region" kind="barh" data={regionBuckets} />
          </div>
        </>
      )}

      {pinned.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" /> Pinned reports
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {pinned.map((p) => (
              <Card key={p.id} className={p.def.dashboardSize === "large" ? "lg:col-span-2" : ""}>
                <div className="px-6 pt-6">
                  <CardTitle className="text-base">
                    <Link href={`/reports/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </CardTitle>
                </div>
                <div className="px-6 pb-6 pt-4">
                  <ReportView definition={p.def} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <AccessSummary />
    </div>
  );
}
