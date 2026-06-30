import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import { parseDefinition } from "@/lib/report";
import type { ReportPreset } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ReportView } from "@/components/report-view";
import { ReportEmailForm } from "@/components/report-email-form";
import { Can } from "@/components/permissions-provider";
import { deleteReport, setDashboardSize, setPinned } from "../actions";
import { Download, Pencil, Pin, Trash2 } from "lucide-react";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let res: Response;
  try {
    res = await apiFetch(`/api/reportpresets/${id}`);
  } catch {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load report.
      </div>
    );
  }
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load report ({res.status}).
      </div>
    );
  }
  const preset = (await res.json()) as ReportPreset;
  const def = parseDefinition(preset.queryParameters);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports" className="text-sm text-muted-foreground hover:underline">
          ← Back to reports
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{preset.name}</h1>
            <Badge variant="secondary" className="capitalize">
              {def.visualization ?? "table"}
            </Badge>
            {def.pinnedToDashboard && <Pin className="size-4 text-brand" />}
          </div>
          <div className="flex items-center gap-2">
            <Can permission="reports:export">
              <a
                href={`/api/reports/${preset.id}/export`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download /> Export CSV
              </a>
            </Can>
            <Can permission="reports:update">
              <form action={setPinned.bind(null, preset.id, !def.pinnedToDashboard)}>
                <Button type="submit" variant="outline" size="sm">
                  <Pin /> {def.pinnedToDashboard ? "Unpin" : "Pin to dashboard"}
                </Button>
              </form>
              {def.pinnedToDashboard && (
                <div className="flex items-center gap-1">
                  <form action={setDashboardSize.bind(null, preset.id, "small")}>
                    <Button type="submit" size="sm" variant={def.dashboardSize === "large" ? "ghost" : "secondary"}>
                      Small
                    </Button>
                  </form>
                  <form action={setDashboardSize.bind(null, preset.id, "large")}>
                    <Button type="submit" size="sm" variant={def.dashboardSize === "large" ? "secondary" : "ghost"}>
                      Large
                    </Button>
                  </form>
                </div>
              )}
              <Link href={`/reports/${preset.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Pencil /> Edit
              </Link>
            </Can>
            <Can permission="reports:delete">
              <form action={deleteReport.bind(null, preset.id)}>
                <Button type="submit" variant="ghost" size="sm">
                  <Trash2 /> Delete
                </Button>
              </form>
            </Can>
          </div>
        </div>
        {preset.description && <p className="text-sm text-muted-foreground">{preset.description}</p>}
      </div>

      <ReportView definition={def} />

      <Can permission="reports:update">
        <ReportEmailForm
          reportId={preset.id}
          initialRecipients={def.emailRecipients ?? []}
          initialFrequency={def.emailFrequency ?? "none"}
        />
      </Can>
    </div>
  );
}
