"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, GitCompare, History, Loader2 } from "lucide-react";
import { getSiteSurveyVersion } from "@/app/(app)/customers/[id]/site-survey-actions";
import { StatusPill } from "@/components/site-survey/compliance/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  describeSurvey,
  diffSurveys,
  formatSurveyDate,
  type Catalogues,
  type SiteSurvey,
  type SurveyVersionSummary,
} from "@/lib/site-survey";
import { cn } from "@/lib/utils";

/** "Submitted by X on Y" / "Saved by X on Y" / "Existing data before survey history". */
export function versionByline(e: SurveyVersionSummary): string {
  if (e.source === "baseline") return "Data on file before survey history began";
  if (e.status === "submitted") {
    const by = e.submittedBy ? ` by ${e.submittedBy}` : "";
    const zm = e.zoneManagerName ? (e.onBehalf ? ` on behalf of ${e.zoneManagerName}` : ` (zone manager)`) : "";
    return `Submitted${by}${zm}${e.submittedOn ? ` on ${formatSurveyDate(e.submittedOn)}` : ""}`;
  }
  const by = e.modifiedBy ?? e.createdBy;
  const on = e.modifiedOn ?? e.createdOn;
  return `Saved${by ? ` by ${by}` : ""}${on ? ` on ${formatSurveyDate(on)}` : ""}`;
}

/** Every version, newest first; click one to open it read-only with what changed. */
export function SurveyHistory({
  entries,
  onOpen,
}: {
  entries: SurveyVersionSummary[];
  onOpen: (version: number) => void;
}) {
  const newestSubmitted = entries.find((e) => e.status === "submitted")?.version;

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
          <p className="text-sm text-muted-foreground">
            No survey versions yet. Submitting the survey starts its history.
          </p>
        ) : (
          <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[11px] before:w-px before:bg-border">
            {entries.map((e) => (
              <li key={e.version} className="relative">
                <button
                  type="button"
                  onClick={() => onOpen(e.version)}
                  className="group flex w-full items-start gap-3 rounded-lg py-2 pr-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-background text-[10px] font-bold text-emerald-600 tabular-nums",
                      e.status === "draft" && "border-dashed border-muted-foreground text-muted-foreground"
                    )}
                  >
                    {e.version}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusPill status={e.status} version={e.version} />
                      {e.version === newestSubmitted && (
                        <span className="rounded-full bg-brand-yellow/30 px-1.5 py-0.5 text-[11px] font-medium">Current</span>
                      )}
                      {e.source === "baseline" && (
                        <span className="rounded-full border px-1.5 py-0.5 text-[11px] text-muted-foreground">Existing data</span>
                      )}
                      {e.source === "legacy" && (
                        <span className="rounded-full border px-1.5 py-0.5 text-[11px] text-muted-foreground">Legacy</span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">{versionByline(e)}</span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** One version, read-only, with what changed since the version before it. */
export function SurveyVersionDialog({
  customerId,
  version,
  previousVersion,
  catalogues,
  onClose,
}: {
  customerId: number;
  version: number | null;
  /** The next-older version, to diff against; null for the first. */
  previousVersion: number | null;
  catalogues: Catalogues;
  onClose: () => void;
}) {
  return (
    <Dialog open={version !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {version !== null && (
          <VersionBody
            key={version}
            customerId={customerId}
            version={version}
            previousVersion={previousVersion}
            catalogues={catalogues}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Loaded =
  | { summary: SurveyVersionSummary; survey: SiteSurvey; previous: SiteSurvey | null }
  | { error: string }
  | null;

function VersionBody({
  customerId,
  version,
  previousVersion,
  catalogues,
}: {
  customerId: number;
  version: number;
  previousVersion: number | null;
  catalogues: Catalogues;
}) {
  const [loaded, setLoaded] = useState<Loaded>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Server actions are dispatched one at a time anyway, so load sequentially.
      const res = await getSiteSurveyVersion(customerId, version);
      const prev = res.ok && previousVersion ? await getSiteSurveyVersion(customerId, previousVersion) : null;
      if (cancelled) return;
      if (!res.ok) setLoaded({ error: res.error });
      else setLoaded({ summary: res.data.summary, survey: res.data.survey, previous: prev?.ok ? prev.data.survey : null });
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, version, previousVersion]);

  if (!loaded) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Version {version}</DialogTitle>
        </DialogHeader>
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 animate-spin" /> Loading…
        </div>
      </>
    );
  }
  if ("error" in loaded) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Version {version}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-destructive">{loaded.error}</p>
      </>
    );
  }

  const values = [...describeSurvey(loaded.survey, catalogues)];
  const changes = loaded.previous ? diffSurveys(loaded.previous, loaded.survey, catalogues) : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          Site survey <StatusPill status={loaded.summary.status} version={loaded.summary.version} />
        </DialogTitle>
        <DialogDescription>{versionByline(loaded.summary)}</DialogDescription>
      </DialogHeader>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {changes && (
          <section className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <GitCompare className="size-4 text-muted-foreground" />
              {changes.length === 0 ? `No changes since v${previousVersion}` : `Changed since v${previousVersion}`}
            </h3>
            {changes.length > 0 && (
              <ul className="space-y-1 text-sm">
                {changes.map((c) => (
                  <li key={c.label} className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-muted-foreground">{c.label}:</span>
                    <span className="line-through decoration-muted-foreground/60">{c.before}</span>
                    <ArrowRight className="size-3 self-center text-muted-foreground" />
                    <span className="font-medium">{c.after}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {values.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded in this version.</p>
        ) : (
          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {values.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </>
  );
}
