"use client";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || source[0]?.toUpperCase() || "?";
}

export function UserMenu({
  name,
  email,
  role,
}: {
  name?: string | null;
  email: string;
  role?: string | null;
}) {
  async function logout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-9 gap-2 px-2")}>
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">{initials(name, email)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm sm:inline">{name || email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="truncate">{name || "User"}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
            {role && (
              <Badge variant="secondary" className="mt-1 w-fit capitalize">
                {role}
              </Badge>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
