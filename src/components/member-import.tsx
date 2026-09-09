"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Finding = {
  severity: "warning" | "error";
  code: string;
  message: string;
  field: string | null;
};

type RowPreview = {
  lineNumber: number;
  memberId: string | null;
  action: "Create" | "Update" | "Unchanged" | "Blocked";
  changes: { field: string; from: string | null; to: string | null }[];
  metadataChanged: boolean;
  vendorsChanged: boolean;
  findings: Finding[];
};

type ImportPreview = {
  fileSha256: string;
  planFingerprint: string;
  summary: {
    total: number;
    created: number;
    updated: number;
    unchanged: number;
    blocked: number;
    invisibleToScopedUsers: number;
  };
  fileFindings: Finding[];
  rows: RowPreview[];
};

const ACTION_VARIANT: Record<RowPreview["action"], "default" | "secondary" | "outline" | "destructive"> = {
  Create: "default",
  Update: "secondary",
  Unchanged: "outline",
  Blocked: "destructive",
};

/** Rows per apply request. Matches the API's default; the API clamps anything larger. */
const BATCH_SIZE = 25;

type Progress = { done: number; total: number; created: number; updated: number };

export function MemberImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);
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
    return fetch(`/api/member-import/${phase}${query}`, {
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

      setPreview(payload as ImportPreview);
      setApplied(false);
    } catch {
      toast.error("Could not read the file.");
    } finally {
      setBusy(false);
    }
  }

  async function runApply() {
    if (!file || !preview) return;

    setBusy(true);
    setProgress({ done: 0, total: preview.summary.total, created: 0, updated: 0 });

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
        const res = await post("apply", csv, `${base}&offset=${offset}&limit=${BATCH_SIZE}`);
        const payload = await res.json();

        if (res.status === 409) {
          // The data moved since the preview, so the API refused. Show the refreshed plan rather
          // than applying something that was never reviewed.
          if (payload.preview) setPreview(payload.preview as ImportPreview);
          toast.error(payload.message ?? "The data changed since the preview. Review it again.");
          return;
        }

        if (!res.ok) {
          // Earlier batches are already committed. Re-running is safe and picks up where this
          // stopped, because the import re-plans and skips rows that already match.
          toast.error(
            `${payload?.title ?? payload?.error ?? `Import failed (${res.status})`} — ` +
              `${offset} of ${preview.summary.total} rows were applied. Re-run to continue.`,
          );
          return;
        }

        created += payload.created ?? 0;
        updated += payload.updated ?? 0;
        offset = payload.nextOffset ?? offset + (payload.processed ?? 0);

        setProgress({ done: offset, total: payload.totalRows ?? preview.summary.total, created, updated });

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

  const summary = preview?.summary;
  const willWrite = summary ? summary.created + summary.updated : 0;
  const visibleRows =
    preview?.rows.filter((r) => !showOnlyChanges || r.action !== "Unchanged") ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose the export file</CardTitle>
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

      {preview && summary && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                2. Review {applied ? "— applied" : "— nothing has been written yet"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["To create", summary.created],
                  ["To update", summary.updated],
                  ["Unchanged", summary.unchanged],
                  ["Blocked", summary.blocked],
                  ["Rows in file", summary.total],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-md border bg-card p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              {summary.invisibleToScopedUsers > 0 && (
                // Called out loudly because Owners and Admins bypass state scoping: without this
                // the person running the import is the one person who cannot see the problem.
                <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    <strong>{summary.invisibleToScopedUsers} row(s)</strong> have no usable store
                    state. Territory access is matched on the store state, so those members would be
                    invisible to every Staff user. They are blocked until the state is corrected in
                    the file.
                  </p>
                </div>
              )}

              {preview.fileFindings.map((finding, i) => (
                <div
                  key={i}
                  className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
                >
                  {finding.message}
                </div>
              ))}

              {progress && (
                // Real progress, not a spinner: the client drives the run a batch at a time, so
                // it knows exactly how many rows are done.
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {applied ? "Applied" : "Applying…"} {progress.done} of {progress.total} rows
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
                      Nothing to write — every row already matches.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Rows</CardTitle>
              <Button variant="ghost" onClick={() => setShowOnlyChanges((v) => !v)}>
                {showOnlyChanges ? "Show all rows" : "Show only changes"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Line</TableHead>
                        <TableHead className="w-28">Member</TableHead>
                        <TableHead className="w-28">Action</TableHead>
                        <TableHead>What changes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                            No rows to show.
                          </TableCell>
                        </TableRow>
                      )}
                      {visibleRows.map((row) => (
                        <TableRow key={row.lineNumber}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {row.lineNumber}
                          </TableCell>
                          <TableCell className="font-medium">{row.memberId ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={ACTION_VARIANT[row.action]}>{row.action}</Badge>
                          </TableCell>
                          <TableCell className="space-y-1 text-sm">
                            {row.changes.map((c) => (
                              <div key={c.field}>
                                <span className="font-medium">{c.field}</span>{" "}
                                <span className="text-muted-foreground">
                                  {c.from || "(blank)"} → {c.to || "(blank)"}
                                </span>
                              </div>
                            ))}
                            {row.metadataChanged && (
                              <div className="text-muted-foreground">Store details updated</div>
                            )}
                            {row.vendorsChanged && (
                              <div className="text-muted-foreground">Vendor selections updated</div>
                            )}
                            {row.findings.map((f, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "text-xs",
                                  f.severity === "error" ? "text-destructive" : "text-amber-600",
                                )}
                              >
                                {f.message}
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
