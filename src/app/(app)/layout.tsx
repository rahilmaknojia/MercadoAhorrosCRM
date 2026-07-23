import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { apiJson } from "@/lib/server/api";
import type { Permissions } from "@/lib/types";
import { PermissionsProvider } from "@/components/permissions-provider";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await headers()).get("cookie");
  const user = await getSession(cookie);
  if (!user) {
    redirect("/login");
  }

  // Resolved permissions drive UI gating (the API still enforces server-side).
  let permissions: Permissions = {
    userId: user.id,
    email: user.email,
    roles: user.role ? [user.role] : [],
    permissions: [],
  };
  try {
    permissions = await apiJson<Permissions>("/api/me/permissions");
  } catch {
    // Fall back to the session role; the user simply sees fewer controls.
  }

  return (
    <PermissionsProvider value={permissions}>
      <AppShell
        user={{ name: user.name, email: user.email }}
        role={permissions.roles[0] ?? user.role}
      >
        {children}
      </AppShell>
      <Toaster />
    </PermissionsProvider>
  );
}
