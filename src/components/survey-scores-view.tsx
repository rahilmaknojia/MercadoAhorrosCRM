"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { useProgressRouter } from "@/components/navigation-progress";
import { Can } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  GROUP_BY_LABELS,
  SURVEY_LABELS,
  toCsv,
  type ScoreGroupBy,
  type SurveyFilter,
  type SurveyScoreReport,
} from "@/lib/survey-scores";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Filters, totals, the per-group table and the individual surveys of the survey scores report. */
export function SurveyScoresView({ report }: { report: SurveyScoreReport }) {
  const router = useProgressRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Filter changes re-run the server page; the group being drilled into is local.
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set(key, value);
    setSelectedGroup(null);
    router.push(`${pathname}?${p.toString()}`);
  }

  // The current year is always offered, even before anything is submitted in it.
  const years = [...new Set([new Date().getFullYear(), report.year, ...report.years])].sort((a, b) => b - a);
  const groupOf = (r: SurveyScoreReport["surveys"][number]) =>
    ((report.groupBy === "submittedBy" ? r.submittedBy : r.zoneManager) ?? "").trim() || "(none)";
  const rows = selectedGroup
    ? report.surveys.filter((r) => groupOf(r).toLowerCase() === selectedGroup.toLowerCase())
    : report.surveys;

  function exportCsv() {
    const blob = new Blob([toCsv({ ...report, surveys: rows })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-survey-scores-${report.year}${selectedGroup ? `-${selectedGroup}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect label="Year" value={String(report.year)} onChange={(v) => setParam("year", v)}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Group by" value={report.groupBy} onChange={(v) => setParam("groupBy", v)}>
          {(Object.keys(GROUP_BY_LABELS) as ScoreGroupBy[]).map((g) => (
            <option key={g} value={g}>
              {GROUP_BY_LABELS[g]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Survey" value={report.survey} onChange={(v) => setParam("survey", v as SurveyFilter)}>
          <option value="all">All surveys</option>
          <option value="coolers">{SURVEY_LABELS.coolers}</option>
          <option value="compliance">{SURVEY_LABELS.compliance}</option>
        </FilterSelect>
        <Can permission="reports:export">
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> Export CSV
          </Button>
        </Can>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Surveys submitted" value={report.totals.surveys.toLocaleString()} />
        <Stat label="Members surveyed" value={report.totals.members.toLocaleString()} />
        <Stat
          label="Submitted unchanged"
          value={report.totals.unchanged.toLocaleString()}
          hint="Surveys submitted without adding, changing or clearing any field."
        />
        <Stat label="Avg completeness" value={`${report.totals.avgCompleteness}%`} />
        <Stat label="Avg activity" value={`${report.totals.avgActivity}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            By {GROUP_BY_LABELS[report.groupBy].toLowerCase()} · {report.year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.groups.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No surveys were submitted in {report.year}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{GROUP_BY_LABELS[report.groupBy]}</TableHead>
                  <TableHead className="text-right">Surveys</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead className="text-right">Coolers</TableHead>
                  <TableHead className="text-right">Compliance</TableHead>
                  <TableHead className="text-right" title="Submitted without adding, changing or clearing any field">
                    Unchanged
                  </TableHead>
                  <TableHead className="w-48">Avg completeness</TableHead>
                  <TableHead className="w-48">Avg activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.groups.map((g) => (
                  <TableRow
                    key={g.key}
                    className={cn("cursor-pointer", selectedGroup === g.key && "bg-muted/60")}
                    onClick={() => setSelectedGroup((s) => (s === g.key ? null : g.key))}
                  >
                    <TableCell className="font-medium">{g.key}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.surveys}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.members}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.coolerSurveys}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.complianceSurveys}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        g.unchanged > 0 && "font-medium text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {g.unchanged}
                      {g.surveys > 0 && g.unchanged > 0 && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({Math.round((100 * g.unchanged) / g.surveys)}%)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={g.avgCompleteness} />
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={g.avgActivity} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {report.surveys.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">
              Surveys{selectedGroup ? ` · ${selectedGroup}` : ""}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{rows.length}</span>
            </CardTitle>
            {selectedGroup && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(null)}>
                Show all
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Survey</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>{report.groupBy === "zoneManager" ? "Submitted by" : "Zone manager"}</TableHead>
                  <TableHead className="text-right">Filled</TableHead>
                  <TableHead className="text-right">Added/changed</TableHead>
                  <TableHead className="w-40">Completeness</TableHead>
                  <TableHead className="w-40">Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.survey}-${r.customerId}-${r.version}`}>
                    <TableCell>
                      <Link
                        href={`/customers/${r.customerId}?tab=survey${r.survey === "compliance" ? "&sub=compliance" : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        <span className="font-medium">{r.memberId || "—"}</span>{" "}
                        <span className="text-muted-foreground">{r.businessName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {SURVEY_LABELS[r.survey]} <span className="text-muted-foreground">v{r.version}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {new Date(r.submittedOn).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </TableCell>
                    <TableCell>{(report.groupBy === "zoneManager" ? r.submittedBy : r.zoneManager) || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.filled}/{r.total}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.changed === 0 ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                          Unchanged
                        </span>
                      ) : (
                        r.changed
                      )}
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={r.completeness} />
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={r.activity} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span className="block">{label}</span>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs" title={hint}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** A percentage with a thin bar behind it. */
function ScoreBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-xs tabular-nums">{value}%</span>
    </div>
  );
}
