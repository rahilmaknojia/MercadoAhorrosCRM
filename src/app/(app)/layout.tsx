import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/server/auth";
import { apiJson } from "@/lib/server/api";
import type { Permissions } from "@/lib/types";
import { PermissionsProvider } from "@/components/permissions-provider";
import { MainNav } from "@/components/main-nav";
import { UserMenu } from "@/components/user-menu";
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
      <div className="flex min-h-svh flex-col">
        {/* Dark navigation: the logo sits on a near-black bar so its black field blends in. */}
        <header className="dark sticky top-0 z-20 border-b border-white/10 bg-zinc-950 text-zinc-100">
          <div className="mx-auto flex h-20 max-w-6xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center" aria-label="Mercado Ahorros home">
              <Image
                src="/Mercado-Logo.png"
                alt="Mercado Ahorros"
                width={1027}
                height={562}
                priority
                className="h-14 w-auto"
              />
            </Link>
            <MainNav />
            <div className="ml-auto">
              <UserMenu name={user.name} email={user.email} role={permissions.roles[0] ?? user.role} />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t py-3 text-center text-xs text-muted-foreground">
          Mercado Ahorros CRM · build {process.env.NEXT_PUBLIC_BUILD_SHA || "dev"}
        </footer>
      </div>
      <Toaster />
    </PermissionsProvider>
  );
}
