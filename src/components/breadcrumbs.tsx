"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Known segments get a friendly label; anything else is humanized. Numeric segments (record ids)
// render as "#123" for now — Phase 2 can resolve them to the record's name via the page.
const LABELS: Record<string, string> = {
  customers: "Customers",
  reports: "Reports",
  settings: "Settings",
  new: "New",
  edit: "Edit",
  profile: "Profile",
  users: "Users",
  "master-data": "Master data",
  territory: "Territory",
};

function humanize(segment: string): string {
  if (LABELS[segment]) return LABELS[segment];
  if (/^\d+$/.test(segment)) return `#${segment}`;
  return segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => ({
    label: humanize(segment),
    href: "/" + segments.slice(0, index + 1).join("/"),
    isLast: index === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 items-center gap-1 text-sm", className)}>
      {segments.length === 0 ? (
        <span className="font-medium text-foreground">Dashboard</span>
      ) : (
        <>
          <Link href="/" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
            Home
          </Link>
          {crumbs.map((crumb) => (
            <Fragment key={crumb.href}>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              {crumb.isLast ? (
                <span className="truncate font-medium text-foreground" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </Fragment>
          ))}
        </>
      )}
    </nav>
  );
}
