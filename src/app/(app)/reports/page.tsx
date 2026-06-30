import Link from "next/link";
import { apiFetch } from "@/lib/server/api";
import { parseDefinition, vizLabel } from "@/lib/report";
import type { ReportPreset } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/permissions-provider";
import { BarChart3, Pin, Plus } from "lucide-react";

export default async function ReportsPage() {
  let presets: ReportPreset[] = [];
  let error: string | null = null;
  try {
    const res = await apiFetch("/api/reportpresets?pageNumber=1&pageSize=200&sortField=name&ascending=true");
    if (res.ok) {
      presets = (await res.json()) as ReportPreset[];
    } else {
      error = `Failed to load reports (${res.status}).`;
    }
  } catch {
    error = "Failed to load reports.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BarChart3 className="h-6 w-6" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Build, save, and pin reports with dynamic filters and charts.
          </p>
        </div>
        <Can permission="reports:create">
          <Link href="/reports/new" className={buttonVariants()}>
            <Plus /> New report
          </Link>
        </Can>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : presets.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          No saved reports yet.{" "}
          <Can permission="reports:create">
            <Link href="/reports/new" className="text-brand underline-offset-4 hover:underline">
              Create your first report
            </Link>
            .
          </Can>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p) => {
            const def = parseDefinition(p.queryParameters);
            return (
              <Link key={p.id} href={`/reports/${p.id}`} className="block">
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        {def.pinnedToDashboard && <Pin className="size-4 text-brand" />}
                        <Badge variant="secondary" className="capitalize">
                          {vizLabel(def)}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>{p.description || "No description"}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
