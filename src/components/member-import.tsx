"use client";

import { AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ActionBadge,
  CsvImport,
  FindingList,
  TableFrame,
  type CsvImportConfig,
  type ImportFinding,
} from "@/components/import/csv-import";

type RowPreview = {
  lineNumber: number;
  memberId: string | null;
  action: "Create" | "Update" | "Unchanged" | "Blocked";
  changes: { field: string; from: string | null; to: string | null }[];
  metadataChanged: boolean;
  vendorsChanged: boolean;
  findings: ImportFinding[];
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
  fileFindings: ImportFinding[];
  rows: RowPreview[];
};

const MEMBER_IMPORT: CsvImportConfig<ImportPreview> = {
  endpoint: "/api/member-import",
  // Rows per apply request. Matches the API's default; the API clamps anything larger.
  batchSize: 25,
  unit: "rows",
  stats: ({ summary }) => [
    ["To create", summary.created],
    ["To update", summary.updated],
    ["Unchanged", summary.unchanged],
    ["Blocked", summary.blocked],
    ["Rows in file", summary.total],
  ],
  total: ({ summary }) => summary.total,
  willWrite: ({ summary }) => summary.created + summary.updated,
  notices: (preview) => (
    <>
      {preview.summary.invisibleToScopedUsers > 0 && (
        // Called out loudly because Owners and Admins bypass state scoping: without this
        // the person running the import is the one person who cannot see the problem.
        <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>{preview.summary.invisibleToScopedUsers} row(s)</strong> have no usable store
            state. Territory access is matched on the store state, so those members would be
            invisible to every Staff user. They are blocked until the state is corrected in
            the file.
          </p>
        </div>
      )}

      {preview.fileFindings.map((finding, i) => (
        <div key={i} className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          {finding.message}
        </div>
      ))}
    </>
  ),
  details: (preview, showAll) => {
    const visibleRows = preview.rows.filter((r) => showAll || r.action !== "Unchanged");
    return (
      <TableFrame>
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
                <TableCell className="tabular-nums text-muted-foreground">{row.lineNumber}</TableCell>
                <TableCell className="font-medium">{row.memberId ?? "—"}</TableCell>
                <TableCell>
                  <ActionBadge action={row.action} />
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
                  {row.metadataChanged && <div className="text-muted-foreground">Store details updated</div>}
                  {row.vendorsChanged && <div className="text-muted-foreground">Vendor selections updated</div>}
                  <FindingList findings={row.findings} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>
    );
  },
};

export function MemberImport() {
  return <CsvImport config={MEMBER_IMPORT} />;
}
