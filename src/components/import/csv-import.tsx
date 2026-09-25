"use client";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The preview → batched-apply flow shared by the CSV imports (members, compliance review
 * history). Each import supplies a config for what differs: the endpoint, the summary tiles and
 * the rows table. The flow itself — pick a file, validate it (writes nothing), review, then apply
 * a batch at a time with real progress, re-planning on a 409 — is the same.
 */

export type ImportFinding = {
  severity: "warning" | "error";
  code: string;
  message: string;
  field: string | null;
};

/** What every preview carries: the guards apply sends back. */
export type BasePreview = { fileSha256: string; planFingerprint: string };

type ApplyPayload = {
  created?: number;
  updated?: number;
  processed?: number;
  nextOffset?: number;
  totalRows?: number;
  hasMore?: boolean;
  message?: string;
  preview?: unknown;
  title?: string;
  error?: string;
};

export type CsvImportConfig<P extends BasePreview> = {
  /** Same-origin BFF path; `/preview` and `/apply` are appended. */
  endpoint: string;
  /** Units per apply request (the API clamps anything larger). */
  batchSize: number;
  /** What a batch pages over, for the progress line ("rows", "members"). */
  unit: string;
  /** Title of the first card. */
  chooseTitle?: string;
  stats: (preview: P) => [label: string, value: number][];
  /** Units the apply loop will walk (apply's totalRows). */
  total: (preview: P) => number;
  /** How many units will actually be written; 0 disables Apply. */
  willWrite: (preview: P) => number;
  /** Extra callouts under the tiles (file findings, scoping warnings). */
  notices?: (preview: P) => ReactNode;
  /** The detail table(s). `showAll` is the "Show all rows" toggle. */
  details: (preview: P, showAll: boolean) => ReactNode;
  detailsTitle?: string;
};

type Progress = { done: number; total: number; created: number; updated: number };

export function CsvImport<P extends BasePreview>({ config }: { config: CsvImportConfig<P> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<P | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  function reset(next: File | null) {
    setFile(next);
    setPreview(null);
    setApplied(false);
    setProgress(null);
  }

  function pick(files: FileList | null) {
    const chosen = files?.[0];
    if (!chosen) return;

    if (!/\.csv$/i.test(chosen.name)) {
      toast.error("Choose a .csv file.");
      return;
    }

    reset(chosen);
  }

  async function post(phase: "preview" | "apply", body: string, query = ""): Promise<Response> {
    return fetch(`${config.endpoint}/${phase}${query}`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body,
    });
  }

  async function runPreview() {
    if (!file) return;
    setBusy(true);

    try {
      const res = await post("preview", await file.text());
      const payload = await res.json();

      if (!res.ok) {
        toast.error(payload?.title ?? payload?.error ?? `Preview failed (${res.status}).`);
        return;
      }

      setPreview(payload as P);
      setApplied(false);
    } catch {
      toast.error("Could not read the file.");
    } finally {
      setBusy(false);
    }
  }

  async function runApply() {
    if (!file || !preview) return;

    const total = config.total(preview);
    setBusy(true);
    setProgress({ done: 0, total, created: 0, updated: 0 });

    try {
      const csv = await file.text();
      const base =
        `?fileSha256=${encodeURIComponent(preview.fileSha256)}` +
        `&planFingerprint=${encodeURIComponent(preview.planFingerprint)}`;

      let offset = 0;
      let created = 0;
      let updated = 0;

      // Driven a batch at a time rather than in one long request. Each batch commits on its own,
      // so no single call runs long enough for an ingress proxy to time out mid-flight - which is
      // what made a staging run look like a failure even though the data had landed.
      for (;;) {
        const res = await post("apply", csv, `${base}&offset=${offset}&limit=${config.batchSize}`);
        const payload = (await res.json().catch(() => ({}))) as ApplyPayload;

        if (res.status === 409) {
          // The data moved since the preview, so the API refused. Show the refreshed plan rather
          // than applying something that was never reviewed.
          if (payload.preview) setPreview(payload.preview as P);
          toast.error(payload.message ?? "The data changed since the preview. Review it again.");
          return;
        }

        if (!res.ok) {
          // Earlier batches are already committed. Re-running is safe and picks up where this
          // stopped, because the import re-plans and skips what already matches.
          toast.error(
            `${payload?.title ?? payload?.error ?? `Import failed (${res.status})`} — ` +
              `${offset} of ${total} ${config.unit} were applied. Re-run to continue.`,
          );
          return;
        }

        created += payload.created ?? 0;
        updated += payload.updated ?? 0;
        offset = payload.nextOffset ?? offset + (payload.processed ?? 0);

        setProgress({ done: offset, total: payload.totalRows ?? total, created, updated });

        if (!payload.hasMore) break;
      }

      setApplied(true);
      toast.success(`Import applied — ${created} created, ${updated} updated.`);
    } catch {
      toast.error("The import could not be completed. Re-run to continue where it stopped.");
    } finally {
      setBusy(false);
    }
  }

  const willWrite = preview ? config.willWrite(preview) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{config.chooseTitle ?? "1. Choose the export file"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center",
              dragOver ? "border-brand ring-2 ring-brand/30" : "border-muted-foreground/25",
            )}
          >
            <FileUp className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {file ? file.name : "Drop the CSV here, or choose a file."}
            </p>
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload /> Choose file
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={runPreview} disabled={!file || busy}>
              {busy && !preview ? "Reading…" : "Validate file"}
            </Button>
            {file && (
              <Button variant="ghost" onClick={() => reset(null)} disabled={busy}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                2. Review {applied ? "— applied" : "— nothing has been written yet"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {config.stats(preview).map(([label, value]) => (
                  <div key={label} className="rounded-md border bg-card p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              {config.notices?.(preview)}

              {progress && (
                // Real progress, not a spinner: the client drives the run a batch at a time, so
                // it knows exactly how many units are done.
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {applied ? "Applied" : "Applying…"} {progress.done} of {progress.total} {config.unit}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {progress.created} created · {progress.updated} updated
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={progress.total}
                    aria-valuenow={progress.done}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-300",
                        applied ? "bg-emerald-500" : "bg-brand",
                      )}
                      style={{
                        width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {busy && (
                    <p className="text-xs text-muted-foreground">
                      Each batch is saved as it completes. If this is interrupted, re-run the
                      import and it will continue from where it stopped.
                    </p>
                  )}
                </div>
              )}

              {!applied && (
                <div className="flex items-center gap-3">
                  <Button onClick={runApply} disabled={busy || willWrite === 0}>
                    {busy ? "Applying…" : `Apply ${willWrite} change(s)`}
                  </Button>
                  {willWrite === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nothing to write — everything already matches.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{config.detailsTitle ?? "Rows"}</CardTitle>
              <Button variant="ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show only changes" : "Show all rows"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">{config.details(preview, showAll)}</CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// --- Shared pieces for the detail tables --------------------------------------------------------

const ACTION_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Create: "default",
  Import: "default",
  Update: "secondary",
  Unchanged: "outline",
  Skipped: "outline",
  Blocked: "destructive",
};

/** The Create / Update / Unchanged / Blocked (or Import / Skipped) badge. */
export function ActionBadge({ action }: { action: string }) {
  return <Badge variant={ACTION_VARIANT[action] ?? "outline"}>{action}</Badge>;
}

/** A row's findings, errors in the destructive colour and warnings in amber. */
export function FindingList({ findings }: { findings: ImportFinding[] }) {
  return (
    <>
      {findings.map((f, i) => (
        <div
          key={i}
          className={cn("text-xs", f.severity === "error" ? "text-destructive" : "text-amber-600")}
        >
          {f.message}
        </div>
      ))}
    </>
  );
}

/** Bordered, horizontally scrollable wrapper for a detail table. */
export function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
