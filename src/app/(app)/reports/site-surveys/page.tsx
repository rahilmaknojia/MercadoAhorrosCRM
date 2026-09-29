import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { apiFetch } from "@/lib/server/api";
import { buttonVariants } from "@/components/ui/button";
import { SurveyScoresView } from "@/components/survey-scores-view";
import type { SurveyScoreReport } from "@/lib/survey-scores";

export default async function SiteSurveyScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; groupBy?: string; survey?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.year && /^\d{4}$/.test(sp.year)) params.set("year", sp.year);
  if (sp.groupBy) params.set("groupBy", sp.groupBy);
  if (sp.survey) params.set("survey", sp.survey);

  let report: SurveyScoreReport | null = null;
  let error: string | null = null;
  try {
    const res = await apiFetch(`/api/reports/survey-scores?${params.toString()}`);
    if (res.ok) report = (await res.json()) as SurveyScoreReport;
    else error = res.status === 403 ? "You do not have permission to view reports." : `Failed to load the report (${res.status}).`;
  } catch {
    error = "Could not reach the API.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site survey scores</h1>
          <p className="text-sm text-muted-foreground">
            Submitted cooler surveys and compliance reviews by zone manager and year. Completeness is the share of
            survey fields filled in; activity is the share the visit added or changed.
          </p>
        </div>
        <Link href="/reports" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ChevronLeft /> Reports
        </Link>
      </div>

      {error || !report ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error ?? "Failed to load the report."}
        </div>
      ) : (
        <SurveyScoresView report={report} />
      )}
    </div>
  );
}
