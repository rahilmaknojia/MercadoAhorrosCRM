"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BreadcrumbProvider } from "@/components/breadcrumb-context";
import { BarChart3, Menu, PanelLeft, Settings, Users, X } from "lucide-react";

const NAV = [
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const COLLAPSE_KEY = "crm.sidebar.collapsed";

function NavLinks({ collapsed, pathname }: { collapsed: boolean; pathname: string }) {
  return (
    <nav className="flex flex-1 flex-col gap-1.5 p-4">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3.5 py-3 text-[15px] font-medium transition-colors",
              collapsed && "justify-center px-0",
              active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
            )}
          >
            {/* Yellow active marker — the logo's accent color. */}
            {active && (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-brand-yellow" />
            )}
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ collapsed, pathname }: { collapsed: boolean; pathname: string }) {
  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <div
        className={cn(
          "flex items-center justify-center border-b border-white/10 px-3",
          collapsed ? "h-20" : "h-28"
        )}
      >
        <Link href="/" className="flex items-center overflow-hidden" aria-label="Mercado Ahorros home">
          <Image
            src="/Mercado-Logo.png"
            alt="Mercado Ahorros"
            width={1027}
            height={562}
            priority
            className={cn("w-auto", collapsed ? "h-10" : "h-20")}
          />
        </Link>
      </div>
      <NavLinks collapsed={collapsed} pathname={pathname} />
      {!collapsed && (
        <div className="border-t border-white/10 px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-500">
          build {process.env.NEXT_PUBLIC_BUILD_SHA || "dev"}
        </div>
      )}
    </div>
  );
}

export function AppShell({
  user,
  role,
  children,
}: {
  user: { name?: string | null; email: string };
  role?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <BreadcrumbProvider>
    <div className="flex h-svh overflow-hidden">
      {/* Desktop sidebar (collapses to an icon rail). */}
      <aside
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 ease-out md:block",
          collapsed ? "md:w-16" : "md:w-60"
        )}
      >
        <SidebarBody collapsed={collapsed} pathname={pathname} />
      </aside>

      {/* Mobile drawer. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64">
            <SidebarBody collapsed={false} pathname={pathname} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-2 top-3 rounded-md p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Light top bar: menu toggle + breadcrumb, profile on the right. */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Toggle sidebar"
            className="hidden size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
          >
            <PanelLeft className="size-5" />
          </button>
          <Breadcrumbs className="min-w-0" />
          <div className="ml-auto shrink-0">
            <UserMenu name={user.name} email={user.email} role={role} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
    </BreadcrumbProvider>
  );
}
