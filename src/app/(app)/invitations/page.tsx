import { headers } from "next/headers";
import { getSession } from "@/lib/server/auth";
import { authApiFetch } from "@/lib/server/auth-api";
import type { InvitedEmail } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { InvitationForm } from "@/components/invitation-form";
import { revokeInvitation } from "./actions";
import { Trash2 } from "lucide-react";

const PRIVILEGED = new Set(["owner", "admin"]);
function isPrivileged(role: string | null | undefined): boolean {
  return (role ?? "")
    .split(",")
    .some((r) => PRIVILEGED.has(r.trim().toLowerCase()));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

export default async function InvitationsPage() {
  const cookie = (await headers()).get("cookie");
  const user = await getSession(cookie);

  // Owner/Admin only. The auth service enforces this too; this is the UX gate.
  if (!isPrivileged(user?.role)) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        You don&apos;t have permission to manage invitations. Only Owners and Admins can.
      </div>
    );
  }

  let invitations: InvitedEmail[] = [];
  let error: string | null = null;
  try {
    const res = await authApiFetch("/api/invitations");
    if (res.ok) {
      invitations = (await res.json()) as InvitedEmail[];
    } else {
      error = `Failed to load invitations (${res.status}).`;
    }
  } catch {
    error = "Failed to load invitations.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invitations</h1>
        <p className="text-sm text-muted-foreground">
          Sign-in is invitation-only. Add an email here before that person can sign in with
          Microsoft. Revoking an invitation does not remove an account that already exists.
        </p>
      </div>

      <InvitationForm />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead className="w-0 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No invitations yet.
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={revokeInvitation}>
                        <input type="hidden" name="email" value={inv.email} />
                        <Button type="submit" variant="ghost" size="sm">
                          <Trash2 /> Revoke
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
