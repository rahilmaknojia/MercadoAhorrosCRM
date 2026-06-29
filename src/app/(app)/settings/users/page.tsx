import { headers } from "next/headers";
import { getSession } from "@/lib/server/auth";
import { authApiFetch } from "@/lib/server/auth-api";
import type { AdminUser, InvitedEmail } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvitationForm } from "@/components/invitation-form";
import { UserRowActions } from "@/components/user-row-actions";
import { revokeInvitation } from "./actions";
import { Trash2 } from "lucide-react";

const PRIVILEGED = new Set(["owner", "admin"]);
function rolesOf(role: string | null | undefined): string[] {
  return (role ?? "").split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
}
function isPrivileged(role: string | null | undefined): boolean {
  return rolesOf(role).some((r) => PRIVILEGED.has(r));
}

function roleVariant(role: string | null | undefined): "default" | "secondary" | "outline" {
  const r = (role ?? "").toLowerCase();
  if (r.includes("owner")) return "default";
  if (r.includes("admin")) return "secondary";
  return "outline";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

export default async function UsersPage() {
  const cookie = (await headers()).get("cookie");
  const viewer = await getSession(cookie);

  // Owner/Admin only. The auth service enforces this too; this is the UX gate.
  if (!isPrivileged(viewer?.role)) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        You don&apos;t have permission to manage users. Only Owners and Admins can.
      </div>
    );
  }

  const viewerIsOwner = rolesOf(viewer?.role).includes("owner");

  let users: AdminUser[] = [];
  let usersError: string | null = null;
  try {
    const res = await authApiFetch("/api/auth/admin/list-users?limit=200&sortBy=createdAt&sortDirection=desc");
    if (res.ok) {
      const body = (await res.json()) as { users?: AdminUser[] };
      users = body.users ?? [];
    } else {
      usersError = `Failed to load users (${res.status}).`;
    }
  } catch {
    usersError = "Failed to load users.";
  }

  let invitations: InvitedEmail[] = [];
  try {
    const res = await authApiFetch("/api/invitations");
    if (res.ok) invitations = (await res.json()) as InvitedEmail[];
  } catch {
    // Non-fatal: show the accounts table even if the allowlist fails to load.
  }

  // Pending = invited but no account yet.
  const accountEmails = new Set(users.map((u) => u.email.toLowerCase()));
  const pending = invitations.filter((i) => !accountEmails.has(i.email.toLowerCase()));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite a user</CardTitle>
          <CardDescription>
            Sign-in is invitation-only. Add an email here before that person can sign in with
            Microsoft. New accounts join as Staff; change their role below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationForm />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">User accounts</h2>
        {usersError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {usersError}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No users yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || "—"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleVariant(u.role)} className="capitalize">
                          {u.role || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.banned ? (
                          <Badge variant="outline" className="text-destructive">
                            Deactivated
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Active</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <UserRowActions
                          user={u}
                          viewerIsOwner={viewerIsOwner}
                          viewerUserId={viewer?.id ?? null}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Pending invitations</h2>
        <p className="text-sm text-muted-foreground">
          Invited emails that have not signed in yet. Revoking does not remove an existing account.
        </p>
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
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No pending invitations.
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
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
      </div>
    </div>
  );
}
