import Link from "next/link";
import { apiFetch } from "@/lib/server/api";
import { formatPhone } from "@/lib/utils";
import type { Customer, PageInfo } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { Can } from "@/components/permissions-provider";
import { Plus, Search, Users } from "lucide-react";

function initials(value?: string | null): string {
  const source = (value || "?").trim();
  const parts = source.split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() ||
    source[0]?.toUpperCase() ||
    "?"
  );
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; meta?: string; filters?: string | string[] }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const meta = (sp.meta ?? "").trim();
  // Generic typed filters (field|op|value), e.g. from a report drill-through.
  const drillFilters = (Array.isArray(sp.filters) ? sp.filters : sp.filters ? [sp.filters] : [])
    .map((f) => f.trim())
    .filter(Boolean);

  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: "25",
    sortField: "memberId",
    ascending: "true",
  });
  if (q) params.append("filters", `businessName|contains|${q}`);
  drillFilters.forEach((f) => params.append("filters", f));
  if (meta) params.append("metadataFilters", meta);

  let customers: Customer[] = [];
  let page: PageInfo | null = null;
  let error: string | null = null;
  try {
    const res = await apiFetch(`/api/customers?${params.toString()}`);
    if (res.ok) {
      customers = (await res.json()) as Customer[];
      const header = res.headers.get("x-pagination");
      page = header ? (JSON.parse(header) as PageInfo) : null;
    } else if (res.status === 400) {
      error = "Invalid filter. Check the metadata filter format: path|operator|value.";
    } else {
      error = `Failed to load customers (${res.status}).`;
    }
  } catch {
    error = "Failed to load customers.";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {page ? `${page.TotalCount.toLocaleString()} member store${page.TotalCount === 1 ? "" : "s"}` : "Member stores"}
          </p>
        </div>
        <Can permission="customers:create">
          <Link href="/customers/new" className={buttonVariants()}>
            <Plus /> New customer
          </Link>
        </Can>
      </div>

      <form
        action="/customers"
        className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs"
      >
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search business name…" className="pl-8" />
        </div>
        <Input
          name="meta"
          defaultValue={meta}
          placeholder="metadata filter, e.g. gas.brand|eq|Shell"
          className="min-w-0 flex-1 sm:max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {(q || meta) && (
          <Link href="/customers" className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        )}
      </form>

      {drillFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtered:</span>
          {drillFilters.map((f, i) => {
            const [field, op, ...rest] = f.split("|");
            return (
              <Badge key={i} variant="secondary">
                {field} {op} {rest.join("|")}
              </Badge>
            );
          })}
          <Link href="/customers" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Clear
          </Link>
        </div>
      )}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="size-8 opacity-40" />
                      <p className="text-sm">No customers found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id} className="group">
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                        <Avatar className="size-9 border">
                          <AvatarFallback className="text-xs font-medium">
                            {initials(c.businessName || c.contactName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium group-hover:underline">
                            {c.businessName || c.contactName || "—"}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{c.memberId}</div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>{c.contactName || "—"}</TableCell>
                    <TableCell>
                      {[c.storeCity, c.storeState].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatPhone(c.storePhone) || c.storePhone || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
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
