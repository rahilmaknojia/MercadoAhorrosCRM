"use client";

import { ChevronRight, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatReviewDate as fmtDate, quarterLabel, REVIEW_ROUNDS, type ComplianceHistorySummary } from "@/lib/compliance";
import { cn } from "@/lib/utils";
import { IssueChips } from "./issue-chips";
import { StatusPill } from "./status-pill";

/** Every version of the review, newest first; click one to open it read-only with its diff. */
export function HistoryTimeline({
  entries,
  currentVersion,
  onOpen,
}: {
  entries: ComplianceHistorySummary[];
  currentVersion: number | null;
  onOpen: (version: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-muted-foreground" /> History
          <span className="text-xs font-normal text-muted-foreground">
            {entries.length} version{entries.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[11px] before:w-px before:bg-border">
            {entries.map((e) => {
              const round = REVIEW_ROUNDS.find((r) => r.value === e.review)?.short;
              const period = [quarterLabel(e.quarter), e.year].filter(Boolean).join(" ");
              const isCurrent = e.version === currentVersion;
              return (
                <li key={e.version} className="relative">
                  <button
                    type="button"
                    onClick={() => onOpen(e.version)}
                    className="group flex w-full items-start gap-3 rounded-lg py-2 pr-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span
                      className={cn(
                        "relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-background text-[10px] font-bold tabular-nums",
                        e.issues.length ? "border-destructive text-destructive" : "border-emerald-500 text-emerald-600",
                        e.status === "draft" && "border-dashed border-muted-foreground text-muted-foreground"
                      )}
                    >
                      {e.version}
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium">
                          {[period, round && `${round} review`].filter(Boolean).join(" · ") || `Version ${e.version}`}
                        </span>
                        <StatusPill status={e.status} version={e.version} />
                        {isCurrent && (
                          <span className="rounded-full bg-brand-yellow/30 px-1.5 py-0.5 text-[11px] font-medium">Current</span>
                        )}
                        {e.source === "legacy" && (
                          <span className="rounded-full border px-1.5 py-0.5 text-[11px] text-muted-foreground">Legacy</span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[
                          e.visitDate && `Visited ${fmtDate(e.visitDate)}`,
                          e.status === "submitted" &&
                            `Submitted${e.submittedBy ? ` by ${e.submittedBy}` : ""}${e.submittedOn ? ` on ${fmtDate(e.submittedOn)}` : ""}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {e.issues.length > 0 && <IssueChips issues={e.issues} size="sm" />}
                    </span>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
