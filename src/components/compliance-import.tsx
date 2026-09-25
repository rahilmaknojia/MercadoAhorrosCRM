"use client";

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

/**
 * Wire shape of POST /api/customers/import/compliance-reviews/preview (ComplianceImportController).
 * Batches page over `customers` (one member's versions are written together), not CSV rows.
 */
type CompliancePreview = {
  fileSha256: string;
  planFingerprint: string;
  summary: {
    /** CSV rows. */
    rows: number;
    imported: number;
    skipped: number;
    blockedRows: number;
    /** Members — what apply's totalRows reports. */
    total: number;
    created: number;
    updated: number;
    unchanged: number;
    blocked: number;
  };
  rows: {
    lineNumber: number;
    legacyId: string | null;
    legacyCustomerId: string | null;
    legacyVersion: number | null;
    outcome: "Import" | "Skipped" | "Blocked";
    customerId: number | null;
    memberId: string | null;
    targetVersion: number | null;
    findings: ImportFinding[];
  }[];
  customers: {
    customerId: number;
    memberId: string | null;
    legacyCustomerId: string | null;
    action: "Create" | "Update" | "Unchanged" | "Blocked";
    reviews: number;
    signatures: number;
    findings: ImportFinding[];
  }[];
};

const COMPLIANCE_IMPORT: CsvImportConfig<CompliancePreview> = {
  endpoint: "/api/member-import/compliance-reviews",
  // Members per apply request — small because each may upload several signatures. Matches the API default.
  batchSize: 10,
  unit: "members",
  stats: ({ summary }) => [
    ["Members to write", summary.created + summary.updated],
    ["Unchanged", summary.unchanged],
    ["Blocked members", summary.blocked],
    ["Reviews to import", summary.imported],
    ["Blank (skipped)", summary.skipped],
  ],
  total: ({ summary }) => summary.total,
  willWrite: ({ summary }) => summary.created + summary.updated,
  notices: ({ summary }) =>
    summary.blockedRows > 0 ? (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        {summary.blockedRows} of {summary.rows} CSV row(s) can&apos;t be imported — see the reasons below.
        Import the members first: reviews are matched on the legacy member id that import records.
      </div>
    ) : null,
  detailsTitle: "Members",
  details: (preview, showAll) => {
    const members = preview.customers.filter((c) => showAll || c.action !== "Unchanged");
    // Imported rows are summarised per member above; list only the exceptions unless asked.
    const rows = preview.rows.filter((r) => showAll || r.outcome !== "Import" || r.findings.length > 0);
    return (
      <>
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Member</TableHead>
                <TableHead className="w-28">Legacy id</TableHead>
                <TableHead className="w-28">Action</TableHead>
                <TableHead>What is written</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No members to show.
                  </TableCell>
                </TableRow>
              )}
              {members.map((c) => (
                <TableRow key={`${c.customerId}-${c.legacyCustomerId}`}>
                  <TableCell className="font-medium">{c.memberId ?? "—"}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{c.legacyCustomerId ?? "—"}</TableCell>
                  <TableCell>
                    <ActionBadge action={c.action} />
                  </TableCell>
                  <TableCell className="space-y-1 text-sm">
                    <div className="text-muted-foreground">
                      {c.reviews} review version{c.reviews === 1 ? "" : "s"}
                      {c.signatures > 0 && ` · ${c.signatures} signature${c.signatures === 1 ? "" : "s"}`}
                    </div>
                    <FindingList findings={c.findings} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            CSV rows{" "}
            <span className="font-normal text-muted-foreground">
              {showAll ? `(all ${preview.rows.length})` : "(skipped, blocked or with warnings)"}
            </span>
          </h3>
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Line</TableHead>
                  <TableHead className="w-28">Legacy id</TableHead>
                  <TableHead className="w-28">Member</TableHead>
                  <TableHead className="w-28">Outcome</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No rows to show.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.lineNumber}>
                    <TableCell className="tabular-nums text-muted-foreground">{r.lineNumber}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {r.legacyId ?? "—"}
                      {r.legacyVersion != null && <span className="text-xs"> · v{r.legacyVersion}</span>}
                    </TableCell>
                    <TableCell className="font-medium">{r.memberId ?? r.legacyCustomerId ?? "—"}</TableCell>
                    <TableCell>
                      <ActionBadge action={r.outcome} />
                    </TableCell>
                    <TableCell className="space-y-1 text-sm">
                      {r.targetVersion != null && (
                        <div className="text-muted-foreground">Becomes v{r.targetVersion}</div>
                      )}
                      <FindingList findings={r.findings} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        </div>
      </>
    );
  },
};

export function ComplianceImport() {
  return <CsvImport config={COMPLIANCE_IMPORT} />;
}
