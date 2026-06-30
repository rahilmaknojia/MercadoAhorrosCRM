import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AccessSummary } from "@/components/access-summary";
import { ReportView } from "@/components/report-view";
import { apiFetch } from "@/lib/server/api";
import { parseDefinition } from "@/lib/report";
import type { ReportDefinition, ReportPreset } from "@/lib/types";
import { BarChart3, Users } from "lucide-react";

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

export default async function DashboardPage() {
  const pinned = await getPinnedReports();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to the Mercado Ahorros CRM.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/customers" className="block">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Customers
              </CardTitle>
              <CardDescription>Browse and manage member stores</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <AccessSummary />
      </div>

      {pinned.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" /> Pinned reports
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {pinned.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    <Link href={`/reports/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <div className="px-6 pb-6">
                  <ReportView definition={p.def} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
