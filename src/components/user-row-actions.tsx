"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserRole, setUserBanned } from "@/app/(app)/settings/users/actions";
import { APP_ROLES, type AdminUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ban, CheckCircle2, MoreHorizontal } from "lucide-react";

const PRIVILEGED = new Set(["owner", "admin"]);

export function UserRowActions({
  user,
  viewerIsOwner,
  viewerUserId,
}: {
  user: AdminUser;
  viewerIsOwner: boolean;
  viewerUserId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isSelf = viewerUserId === user.id;
  const targetPrivileged = PRIVILEGED.has((user.role ?? "").toLowerCase());
  // Admins may only manage Staff/User accounts; Owners may manage anyone.
  const canManage = viewerIsOwner || !targetPrivileged;

  if (isSelf || !canManage) {
    return <span className="text-muted-foreground">—</span>;
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? "Action failed.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="User actions"
        disabled={pending}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Set role</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {APP_ROLES.map((role) => {
              const current = (user.role ?? "").toLowerCase() === role;
              const grantsPrivileged = PRIVILEGED.has(role);
              const disabled = current || (!viewerIsOwner && grantsPrivileged);
              return (
                <DropdownMenuItem
                  key={role}
                  disabled={disabled}
                  className="capitalize"
                  onClick={() => run(() => setUserRole(user.id, role), `Role set to ${role}.`)}
                >
                  {role}
                  {current && <span className="ml-auto text-xs text-muted-foreground">current</span>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {user.banned ? (
          <DropdownMenuItem
            onClick={() => run(() => setUserBanned(user.id, false), "User reactivated.")}
          >
            <CheckCircle2 /> Reactivate
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => run(() => setUserBanned(user.id, true), "User deactivated.")}
          >
            <Ban /> Deactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
