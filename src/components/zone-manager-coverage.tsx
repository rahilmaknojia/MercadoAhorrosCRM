import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ZoneManagerCoverageReport } from "@/lib/survey-worklist";
import { cn } from "@/lib/utils";

/**
 * Who has completed their surveys: per zone manager, the share of their assigned active members
 * surveyed at least once this year (required) and twice (recommended), plus average completeness.
 * Each row opens that zone manager's member list.
 */
export function ZoneManagerCoverage({ report }: { report: ZoneManagerCoverageReport }) {
  const t = report.totals;
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Zone manager coverage · {report.year}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Active members surveyed at least {report.required}× (required) and {report.recommended}× (recommended) this
          year, out of the members each zone manager is assigned. Overall: {t.completed} of {t.members} surveyed (
          {t.completionRate}%), {t.recommendedMet} twice ({t.recommendedRate}%).
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {report.zoneManagers.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No zone managers yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone manager</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="w-52">Surveyed (required)</TableHead>
                <TableHead className="w-52">Surveyed twice</TableHead>
                <TableHead className="text-right">In progress</TableHead>
                <TableHead className="text-right">To do</TableHead>
                <TableHead className="text-right">Avg completeness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.zoneManagers.map((z) => (
                <TableRow key={z.zoneManagerId ?? "none"}>
                  <TableCell>
                    {z.zoneManagerId ? (
                      <Link href={`/surveys?zm=${z.zoneManagerId}&year=${report.year}`} className="font-medium hover:underline">
                        {z.zoneManagerName}
                      </Link>
                    ) : (
                      <span className="font-medium text-muted-foreground">{z.zoneManagerName}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {!z.isActive ? "Inactive · " : ""}
                      {z.zoneManagerId ? (z.linkedUserName ?? "No user linked") : "Members without a zone manager"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{z.totals.members}</TableCell>
                  <TableCell>
                    <Rate value={z.totals.completionRate} count={z.totals.completed} of={z.totals.members} />
                  </TableCell>
                  <TableCell>
                    <Rate value={z.totals.recommendedRate} count={z.totals.recommendedMet} of={z.totals.members} light />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{z.totals.inProgress}</TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", z.totals.notStarted > 0 && "font-medium text-destructive")}
                  >
                    {z.totals.notStarted}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {z.totals.avgCompleteness === null ? "—" : `${z.totals.avgCompleteness}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Rate({ value, count, of, light }: { value: number; count: number; of: number; light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", light ? "bg-emerald-400" : "bg-emerald-600")}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="w-20 text-right text-xs tabular-nums">
        {count}/{of} · {value}%
      </span>
    </div>
  );
}
