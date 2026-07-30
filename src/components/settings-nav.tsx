"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useCan, useIsPrivileged } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Database, FileSignature, LogOut, Settings2, User, Users } from "lucide-react";

export function SettingsNav() {
  const pathname = usePathname();
  const privileged = useIsPrivileged();
  const canReadMasterData = useCan("master_data:read");
  const canManageEsignature = useCan("esignature_templates:manage");
  const canSystemSettings = useCan("owner:system_settings");

  const items = [
    { href: "/settings/profile", label: "Profile", icon: User, show: true },
    { href: "/settings/users", label: "Users", icon: Users, show: privileged },
    { href: "/settings/master-data", label: "Master data", icon: Database, show: canReadMasterData },
    { href: "/settings/esignature", label: "eSignature", icon: FileSignature, show: canManageEsignature },
    { href: "/settings/system", label: "System", icon: Settings2, show: canSystemSettings },
  ].filter((i) => i.show);

  async function logout() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}

      <div className="mt-2 border-t pt-2">
        <Button
          variant="ghost"
          onClick={logout}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </nav>
  );
}
