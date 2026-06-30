"use client";

import { useEffect, useState } from "react";
import type { CustomerLog } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const PAGE_SIZE = 10;

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function CustomerActivity({ customerId }: { customerId: number }) {
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<CustomerLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/customer-logs?customerId=${customerId}&pageNumber=${page}&pageSize=${PAGE_SIZE}`,
          { cache: "no-store" }
        );
        const rows = res.ok ? ((await res.json()) as CustomerLog[]) : [];
        if (!active) return;
        setLogs(Array.isArray(rows) ? rows : []);
        const header = res.headers.get("x-pagination");
        if (header) {
          const p = JSON.parse(header) as { TotalCount?: number; TotalPages?: number };
          setTotal(p.TotalCount ?? rows.length);
          setTotalPages(Math.max(1, p.TotalPages ?? 1));
        } else {
          setTotal(rows.length);
          setTotalPages(1);
        }
      } catch {
        if (active) setLogs([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [customerId, page]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activity</h2>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {total} entr{total === 1 ? "y" : "ies"}
          </span>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">When</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-44">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline size-4 animate-spin" /> Loading activity…
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                  No activity recorded.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground">{fmtDateTime(log.createdOn)}</TableCell>
                  <TableCell>{log.message}</TableCell>
                  <TableCell className="text-muted-foreground">{log.createdBy || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
