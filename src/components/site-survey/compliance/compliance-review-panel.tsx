"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  ClipboardCheck,
  CopyPlus,
  FilePen,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import {
  discardComplianceDraft,
  getComplianceReviews,
  saveComplianceDraft,
  submitComplianceReview,
} from "@/app/(app)/customers/[id]/compliance-actions";
import { useCan } from "@/components/permissions-provider";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  answersOf,
  blankAnswers,
  computeIssues,
  countSubmittedInQuarter,
  formatReviewDate,
  overallProgress,
  quarterLabel,
  roundLabel,
  suggestRound,
  summarize,
  type ComplianceAnswers,
  type ComplianceState,
} from "@/lib/compliance";
import { cn } from "@/lib/utils";
import { HistoryTimeline } from "./history-timeline";
import { IssueChips } from "./issue-chips";
import { ReviewForm } from "./review-form";
import { SignatureBlock } from "./signature-block";
import { StatusPill } from "./status-pill";
import { SubmitDialog } from "./submit-dialog";
import { VersionDialog } from "./version-dialog";

/** Autosave debounce after the last change. */
const AUTOSAVE_MS = 1500;

type SaveStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string }
  | { kind: "conflict" };

type Busy = null | "start" | "amend" | "submit" | "discard" | "reload";

/**
 * The Compliance Review panel (spec §2): the current review (a draft being filled in, or the
 * submitted one, read-only), its issues and progress, and the version history.
 *
 * Draft autosave: every change marks the draft dirty and (re)arms a 1.5 s timer; saves are
 * chained so only one is ever in flight, and each sends the version it last saw as
 * `expectedVersion`. A 409 stops autosave and offers to reload the latest copy rather than
 * overwrite someone else's work. Saves don't revalidate the page — this component owns the state.
 */
export function ComplianceReviewPanel({
  customerId,
  initial,
  initialError,
}: {
  customerId: number;
  initial: ComplianceState | null;
  initialError?: string | null;
}) {
  const canEdit = useCan("customer_data:update");
  const [state, setState] = useState<ComplianceState | null>(initial);
  const [loadError, setLoadError] = useState<string | null>(initialError ?? null);
  const [answers, setAnswers] = useState<ComplianceAnswers>(() => answersOf(initial?.current));
  const [save, setSave] = useState<SaveStatus>({ kind: "idle" });
  const [busy, setBusy] = useState<Busy>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [viewVersion, setViewVersion] = useState<number | null>(null);

  // Autosave machinery. Refs, because the timer and the save chain outlive any one render.
  const answersRef = useRef(answers);
  const versionRef = useRef<number | null>(initial?.current?.version ?? null);
  const dirtyRef = useRef(false);
  const conflictRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const current = state?.current ?? null;
  const editable = canEdit && current?.status === "draft";

  /** Replace everything with a server state (after load, submit, discard, start, reload). */
  function applyState(next: ComplianceState) {
    clearTimeout(timerRef.current);
    const a = answersOf(next.current);
    setState(next);
    setAnswers(a);
    answersRef.current = a;
    versionRef.current = next.current?.version ?? null;
    dirtyRef.current = false;
    conflictRef.current = false;
    setSave({ kind: "idle" });
  }

  function queueSave(): Promise<boolean> {
    const run = chainRef.current.then(doSave);
    chainRef.current = run.catch(() => false);
    return run;
  }

  async function doSave(): Promise<boolean> {
    if (conflictRef.current) return false;
    if (!dirtyRef.current) return true;
    dirtyRef.current = false;
    setSave({ kind: "saving" });

    const res = await saveComplianceDraft(customerId, versionRef.current, answersRef.current).catch(() => null);
    if (res?.ok) {
      const { review, state: refreshed } = res.data;
      versionRef.current = review.version;
      setState((s) => ({ current: review, history: refreshed?.history ?? s?.history ?? [] }));
      setSave(dirtyRef.current ? { kind: "pending" } : { kind: "saved", at: new Date() });
      return true;
    }

    dirtyRef.current = true;
    if (res && !res.ok && res.conflict) {
      conflictRef.current = true;
      setSave({ kind: "conflict" });
      toastConflict(res.error);
    } else {
      setSave({ kind: "error", message: res && !res.ok ? res.error : "Could not reach the server." });
    }
    return false;
  }

  // Warn before leaving with unsaved answers; flush a pending save if the panel unmounts.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearTimeout(timerRef.current);
      if (dirtyRef.current && !conflictRef.current) void queueSave();
    };
    // queueSave only touches refs and stable setters; running this once is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toastConflict(message: string) {
    toast.error("This review was changed elsewhere.", {
      description: `${message} Your latest edits were not saved.`,
      duration: Infinity,
      action: { label: "Reload latest", onClick: () => void reload() },
    });
  }

  function change(next: ComplianceAnswers) {
    setAnswers(next);
    answersRef.current = next;
    dirtyRef.current = true;
    if (conflictRef.current) return;
    setSave({ kind: "pending" });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void queueSave(), AUTOSAVE_MS);
  }

  function retrySave() {
    clearTimeout(timerRef.current);
    void queueSave();
  }

  async function reload() {
    setBusy("reload");
    const res = await getComplianceReviews(customerId);
    setBusy(null);
    if (res.ok) {
      applyState(res.data);
      setLoadError(null);
    } else {
      toast.error(res.error);
      if (!state) setLoadError(res.error);
    }
  }

  // Everything already on record, newest first — drives the timeline and the round suggestion.
  const entries = [...(current ? [summarize(current)] : []), ...(state?.history ?? [])].sort(
    (a, b) => b.version - a.version
  );

  function suggestFor(year?: number, quarter?: string) {
    if (!year || !quarter) return null;
    const submitted = countSubmittedInQuarter(entries, year, quarter, current?.version);
    return { round: suggestRound(submitted), submitted };
  }

  /** "Start new review" (blank) and "Amend" (prefilled) are both just PUT draft. */
  async function startDraft(kind: "start" | "amend") {
    const prefill: ComplianceAnswers =
      kind === "amend" && current ? answersOf(current) : blankAnswers(entries);
    setBusy(kind);
    const res = await saveComplianceDraft(customerId, current?.version ?? null, prefill);
    setBusy(null);
    if (res.ok) {
      applyState(res.data.state ?? { current: res.data.review, history: state?.history ?? [] });
      toast.success(kind === "amend" ? "Amendment started — changes save automatically." : "New review started.");
    } else if (res.conflict) {
      toastConflict(res.error);
    } else {
      toast.error(res.error);
    }
  }

  async function submit(signature: string) {
    setBusy("submit");
    clearTimeout(timerRef.current);
    await chainRef.current; // let an in-flight autosave land so expectedVersion is right
    const res = await submitComplianceReview(customerId, versionRef.current, answersRef.current, signature);
    setBusy(null);
    if (res.ok) {
      applyState(res.data);
      setSubmitOpen(false);
      toast.success(`Compliance review v${res.data.current?.version ?? ""} submitted.`);
    } else if (res.conflict) {
      setSubmitOpen(false);
      conflictRef.current = true;
      setSave({ kind: "conflict" });
      toastConflict(res.error);
    } else {
      toast.error(res.error);
    }
  }

  async function discard() {
    if (versionRef.current === null) return;
    setBusy("discard");
    clearTimeout(timerRef.current);
    await chainRef.current;
    const res = await discardComplianceDraft(customerId, versionRef.current!);
    setBusy(null);
    setDiscardOpen(false);
    if (res.ok) {
      applyState(res.data);
      toast.success("Draft discarded.");
    } else if (res.conflict) {
      toastConflict(res.error);
    } else {
      toast.error(res.error);
    }
  }

  // --- Render -----------------------------------------------------------------------------

  if (!state) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="size-6 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Couldn&apos;t load compliance reviews</p>
            {loadError && <p className="text-sm text-muted-foreground">{loadError}</p>}
          </div>
          <Button size="sm" variant="outline" onClick={() => void reload()} disabled={busy === "reload"}>
            {busy === "reload" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const issues = editable ? computeIssues(answers) : Object.keys(current?.issues ?? {});
  const progress = overallProgress(answers);
  const previousOf = (v: number) => entries.find((e) => e.version < v)?.version ?? null;

  return (
    <>
      {!current ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardCheck className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">No compliance review yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Walk the store with the checklist: display space, POS, cold equipment, cold vault and
                the program conversation. Answers save as you go.
              </p>
            </div>
            {canEdit && (
              <Button onClick={() => void startDraft("start")} disabled={busy !== null}>
                {busy === "start" ? <Loader2 className="animate-spin" /> : <Plus />} Start review
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-visible">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="min-w-0 space-y-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                Compliance review
                <StatusPill status={current.status} version={current.version} />
                {current.source === "legacy" && (
                  <span className="rounded-full border px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                    Legacy
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {[
                  [quarterLabel(answers.quarter), answers.year].filter(Boolean).join(" "),
                  roundLabel(answers.review),
                  current.status === "draft" &&
                    current.modified_on &&
                    `Last saved ${formatReviewDate(current.modified_on, true)}${current.modified_by ? ` by ${current.modified_by}` : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            {canEdit && current.status === "submitted" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void startDraft("amend")} disabled={busy !== null}>
                  {busy === "amend" ? <Loader2 className="animate-spin" /> : <FilePen />} Amend
                </Button>
                <Button size="sm" onClick={() => void startDraft("start")} disabled={busy !== null}>
                  {busy === "start" ? <Loader2 className="animate-spin" /> : <CopyPlus />} Start new review
                </Button>
              </div>
            )}
            {editable && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDiscardOpen(true)}
                disabled={busy !== null}
              >
                <Trash2 /> Discard draft
              </Button>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <IssueChips issues={issues} showNone={current.status === "submitted" || progress.answered > 0} />

            {current.status === "draft" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Overall progress</span>
                  <span className="tabular-nums">
                    {progress.answered} / {progress.total} answered
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.answered}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      progress.answered === progress.total ? "bg-emerald-500" : "bg-primary"
                    )}
                    style={{ width: `${progress.total ? (progress.answered / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <ReviewForm
              answers={answers}
              onChange={editable ? change : undefined}
              readOnly={!editable}
              suggestFor={suggestFor}
            />

            {current.status === "submitted" && <SignatureBlock customerId={customerId} review={current} />}
          </CardContent>

          {editable && (
            // Sticky so Submit and the save state stay in reach on a long form, especially on a phone.
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <SaveIndicator
                status={save}
                lastSaved={current.modified_on}
                onRetry={retrySave}
                onReload={() => void reload()}
              />
              <Button onClick={() => setSubmitOpen(true)} disabled={busy !== null}>
                <Send /> Submit review
              </Button>
            </div>
          )}
        </Card>
      )}

      {entries.length > 0 && (
        <HistoryTimeline entries={entries} currentVersion={current?.version ?? null} onOpen={setViewVersion} />
      )}

      <SubmitDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        answers={answers}
        version={current?.version ?? null}
        submitting={busy === "submit"}
        onSubmit={(sig) => void submit(sig)}
      />

      <VersionDialog
        customerId={customerId}
        version={viewVersion}
        previousVersion={viewVersion ? previousOf(viewVersion) : null}
        onClose={() => setViewVersion(null)}
      />

      <AlertDialog open={discardOpen} onOpenChange={(o) => busy !== "discard" && setDiscardOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              {entries.some((e) => e.version !== current?.version)
                ? "The draft's answers are deleted and the previous version becomes current again."
                : "The draft's answers are deleted. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" disabled={busy === "discard"} />}>Keep draft</AlertDialogClose>
            <Button variant="destructive" onClick={() => void discard()} disabled={busy === "discard"}>
              {busy === "discard" ? <Loader2 className="animate-spin" /> : <Trash2 />} Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SaveIndicator({
  status,
  lastSaved,
  onRetry,
  onReload,
}: {
  status: SaveStatus;
  lastSaved?: string;
  onRetry: () => void;
  onReload: () => void;
}) {
  const time = (d: Date) => new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(d);
  const base = "flex items-center gap-1.5 text-xs";
  switch (status.kind) {
    case "saving":
      return (
        <span className={cn(base, "text-muted-foreground")} aria-live="polite">
          <Loader2 className="size-3.5 animate-spin" /> Saving…
        </span>
      );
    case "pending":
      return (
        <span className={cn(base, "text-muted-foreground")}>
          <span className="size-1.5 rounded-full bg-brand-yellow" /> Unsaved changes
        </span>
      );
    case "saved":
      return (
        <span className={cn(base, "text-emerald-700 dark:text-emerald-400")} aria-live="polite">
          <Check className="size-3.5" /> Saved {time(status.at)}
        </span>
      );
    case "error":
      return (
        <span className={cn(base, "text-destructive")} aria-live="assertive" title={status.message}>
          <AlertCircle className="size-3.5" /> Couldn&apos;t save —
          <button type="button" className="font-medium underline underline-offset-2" onClick={onRetry}>
            retry
          </button>
        </span>
      );
    case "conflict":
      return (
        <span className={cn(base, "text-destructive")} aria-live="assertive">
          <AlertCircle className="size-3.5" /> Changed elsewhere —
          <button type="button" className="font-medium underline underline-offset-2" onClick={onReload}>
            reload latest
          </button>
        </span>
      );
    default:
      return (
        <span className={cn(base, "text-muted-foreground")}>
          <Check className="size-3.5" />
          {lastSaved ? `Saved ${time(new Date(lastSaved))}` : "Changes save automatically"}
        </span>
      );
  }
}

