import Link from "next/link";
import { apiFetch } from "@/lib/server/api";
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
import { Can } from "@/components/permissions-provider";
import { Plus } from "lucide-react";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Active") return "default";
  if (status === "Inactive") return "outline";
  return "secondary";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; meta?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const meta = (sp.meta ?? "").trim();

  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: "25",
    sortField: "memberId",
    ascending: "true",
  });
  if (q) params.append("filters", `businessName|contains|${q}`);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {page ? `${page.TotalCount} member store(s)` : "Member stores"}
          </p>
        </div>
        <Can permission="customers:create">
          <Link href="/customers/new" className={buttonVariants()}>
            <Plus /> New customer
          </Link>
        </Can>
      </div>

      <form action="/customers" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search business name…"
          className="max-w-xs"
        />
        <Input
          name="meta"
          defaultValue={meta}
          placeholder="metadata filter, e.g. gas.brand|eq|Shell"
          className="max-w-sm"
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

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No customers found.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.memberId}</TableCell>
                    <TableCell>{c.businessName ?? "—"}</TableCell>
                    <TableCell>{c.contactName}</TableCell>
                    <TableCell>
                      {[c.storeCity, c.storeState].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{c.storePhone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
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
