"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { approveMember } from "@/app/(app)/customers/approvals/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer } from "@/lib/types";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

export function ApprovalsTable({ members }: { members: Customer[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  function approve(id: number) {
    setApprovingId(id);
    startTransition(async () => {
      const res = await approveMember(id);
      setApprovingId(null);
      if (res.ok) {
        toast.success("Member approved.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not approve the member.");
      }
    });
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground shadow-xs">
        No members are awaiting approval.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business / Contact</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="w-40">Submitted</TableHead>
            <TableHead className="w-32 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                  {c.businessName || c.contactName || `Member ${c.id}`}
                </Link>
                {c.businessName && c.contactName && (
                  <div className="text-xs text-muted-foreground">{c.contactName}</div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {[c.storeCity, c.storeState].filter(Boolean).join(", ") || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{fmtDate(c.createdOn)}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  onClick={() => approve(c.id)}
                  disabled={pending && approvingId === c.id}
                >
                  {pending && approvingId === c.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Approve
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
