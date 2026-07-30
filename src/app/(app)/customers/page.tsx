import Link from "next/link";
import { apiFetch } from "@/lib/server/api";
import { cn, formatPhone } from "@/lib/utils";
import type { Customer, PageInfo, VendorGroup } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/status-badge";
import { CustomerFilterBuilder } from "@/components/customer-filter-builder";
import { parseConditions } from "@/lib/customer-filters";
import { Can } from "@/components/permissions-provider";
import { ArrowDown, ArrowUp, ChevronsUpDown, Eye, Pencil, Plus, Search, Users } from "lucide-react";

const SORTABLE_FIELDS = new Set(["memberId", "contactName", "storeCity", "status"]);
const PAGE_SIZE = 25;

function initials(value?: string | null): string {
  const source = (value || "?").trim();
  const parts = source.split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() ||
    source[0]?.toUpperCase() ||
    "?"
  );
}

// Compact page list with ellipses, e.g. 1 … 4 5 6 … 20.
function pageWindow(current: number, total: number): (number | "gap")[] {
  const shown = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...shown].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    meta?: string | string[];
    filters?: string | string[];
    vendors?: string;
    vmatch?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  // Typed field filters (field|op|value) and store-metadata filters (path|op|value); both come
  // from the advanced filter builder (and field filters also from report drill-through).
  const drillFilters = (Array.isArray(sp.filters) ? sp.filters : sp.filters ? [sp.filters] : [])
    .map((f) => f.trim())
    .filter(Boolean);
  const metaFilters = (Array.isArray(sp.meta) ? sp.meta : sp.meta ? [sp.meta] : [])
    .map((m) => m.trim())
    .filter(Boolean);
  const initialConditions = parseConditions(drillFilters, metaFilters);
  // Vendor filter: comma-separated vendor codes, plus AND/OR across them.
  const vendorCodes = (sp.vendors ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const vendorMatchAll = sp.vmatch === "all";
  const sortField = SORTABLE_FIELDS.has(sp.sort ?? "") ? sp.sort! : "memberId";
  const ascending = (sp.dir ?? "asc") !== "desc";
  const pageNumber = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(PAGE_SIZE),
    sortField,
    ascending: String(ascending),
  });
  // Simple search: OR across the fields a user is likely to know a store by. Sent as a single
  // filterGroup (clauses joined by ";;" are OR'd; separate groups AND). Drill filters stay AND.
  if (q) {
    const searchFields = ["memberId", "businessName", "contactName", "storeAddress", "storePhone", "email"];
    params.append("filterGroups", searchFields.map((f) => `${f}|contains|${q}`).join(";;"));
  }
  drillFilters.forEach((f) => params.append("filters", f));
  metaFilters.forEach((m) => params.append("metadataFilters", m));
  if (vendorCodes.length > 0) {
    params.set("vendorCodes", vendorCodes.join(","));
    params.set("matchAll", String(vendorMatchAll));
  }

  let customers: Customer[] = [];
  let page: PageInfo | null = null;
  let error: string | null = null;
  let vendorGroups: VendorGroup[] = [];
  try {
    // The vendor catalogue powers the filter picker; a failure there must not blank the list.
    const [res, vendorRes] = await Promise.all([
      apiFetch(`/api/customers?${params.toString()}`),
      apiFetch("/api/vendors/grouped").catch(() => null),
    ]);
    if (vendorRes?.ok) {
      vendorGroups = (await vendorRes.json()) as VendorGroup[];
    }
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

  // Build a members-list URL that preserves the current query, applying overrides.
  const hrefWith = (overrides: { sort?: string; dir?: string; page?: number } = {}) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    metaFilters.forEach((m) => usp.append("meta", m));
    drillFilters.forEach((f) => usp.append("filters", f));
    if (vendorCodes.length > 0) {
      usp.set("vendors", vendorCodes.join(","));
      if (vendorMatchAll) usp.set("vmatch", "all");
    }
    const sort = overrides.sort ?? sortField;
    const dir = overrides.dir ?? (ascending ? "asc" : "desc");
    const pg = overrides.page ?? pageNumber;
    if (sort !== "memberId") usp.set("sort", sort);
    if (dir !== "asc") usp.set("dir", dir);
    if (pg > 1) usp.set("page", String(pg));
    const query = usp.toString();
    return query ? `/customers?${query}` : "/customers";
  };
  // A sortable column header: toggles direction when already active, else ascending, resets page.
  const sortHref = (field: string) =>
    hrefWith({ sort: field, dir: sortField === field && ascending ? "desc" : "asc", page: 1 });
  const SortHead = ({ field, label }: { field: string; label: string }) => {
    const active = sortField === field;
    return (
      <TableHead>
        <Link href={sortHref(field)} className="inline-flex items-center gap-1 hover:text-foreground">
          {label}
          {active ? (
            ascending ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
          ) : (
            <ChevronsUpDown className="size-3.5 opacity-40" />
          )}
        </Link>
      </TableHead>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {page ? `${page.TotalCount.toLocaleString()} member store${page.TotalCount === 1 ? "" : "s"}` : "Member stores"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Can permission="customers:approve">
            <Link href="/customers/approvals" className={buttonVariants({ variant: "outline" })}>
              Approvals
            </Link>
          </Can>
          <Can permission="customers:create">
            <Link href="/customers/new" className={buttonVariants()}>
              <Plus /> New customer
            </Link>
          </Can>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-3 shadow-xs">
        <form action="/customers" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search member ID, business, contact, address, phone, or email…"
              className="pl-8"
            />
          </div>
          {/* Preserve any active advanced filters when running a simple search. */}
          {drillFilters.map((f, i) => (
            <input key={`f-${i}`} type="hidden" name="filters" value={f} />
          ))}
          {metaFilters.map((m, i) => (
            <input key={`m-${i}`} type="hidden" name="meta" value={m} />
          ))}
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {(q || drillFilters.length > 0 || metaFilters.length > 0) && (
            <Link href="/customers" className={buttonVariants({ variant: "ghost" })}>
              Clear all
            </Link>
          )}
        </form>
        <CustomerFilterBuilder
          q={q}
          initialConditions={initialConditions}
          vendorGroups={vendorGroups}
          initialVendorCodes={vendorCodes}
          initialMatchAll={vendorMatchAll}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHead field="memberId" label="Member" />
                  <SortHead field="contactName" label="Contact" />
                  <SortHead field="storeCity" label="Location" />
                  <TableHead>Phone</TableHead>
                  <SortHead field="status" label="Status" />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="h-40 text-center">
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
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate">{c.contactName || "—"}</div>
                          {c.email && (
                            <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate">{c.storeAddress || "—"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[c.storeCity, c.storeState].filter(Boolean).join(", ")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatPhone(c.storePhone) || c.storePhone || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <Link
                            href={`/customers/${c.id}`}
                            aria-label="View member"
                            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          >
                            <Eye />
                          </Link>
                          <Can permission="customers:update">
                            <Link
                              href={`/customers/${c.id}/edit`}
                              aria-label="Edit member"
                              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            >
                              <Pencil />
                            </Link>
                          </Can>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {page && page.TotalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {pageNumber} of {page.TotalPages} · {page.TotalCount.toLocaleString()} total
              </p>
              <div className="flex items-center gap-1">
                {page.HasPreviousPage ? (
                  <Link
                    href={hrefWith({ page: pageNumber - 1 })}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "pointer-events-none opacity-50"
                    )}
                  >
                    Previous
                  </span>
                )}
                {pageWindow(pageNumber, page.TotalPages).map((n, i) =>
                  n === "gap" ? (
                    <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
                      …
                    </span>
                  ) : n === pageNumber ? (
                    <span
                      key={n}
                      aria-current="page"
                      className={cn(buttonVariants({ variant: "secondary", size: "icon-sm" }), "pointer-events-none")}
                    >
                      {n}
                    </span>
                  ) : (
                    <Link
                      key={n}
                      href={hrefWith({ page: n })}
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    >
                      {n}
                    </Link>
                  )
                )}
                {page.HasNextPage ? (
                  <Link
                    href={hrefWith({ page: pageNumber + 1 })}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Next
                  </Link>
                ) : (
                  <span
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "pointer-events-none opacity-50"
                    )}
                  >
                    Next
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
