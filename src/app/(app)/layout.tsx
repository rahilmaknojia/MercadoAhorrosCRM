import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/server/auth";
import { apiJson } from "@/lib/server/api";
import type { Permissions } from "@/lib/types";
import { PermissionsProvider } from "@/components/permissions-provider";
import { MainNav } from "@/components/main-nav";
import { UserMenu } from "@/components/user-menu";

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
      <div className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-10 border-b bg-background">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="font-semibold">
              Mercado Ahorros
            </Link>
            <MainNav />
            <div className="ml-auto">
              <UserMenu name={user.name} email={user.email} role={permissions.roles[0] ?? user.role} />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </PermissionsProvider>
  );
}
