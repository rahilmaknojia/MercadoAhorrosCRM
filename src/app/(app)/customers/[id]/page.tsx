import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import type { Customer, StoreMetadata } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/permissions-provider";
import { CustomerPhotos } from "@/components/customer-photos";
import { CustomerActivity } from "@/components/customer-activity";
import { Pencil } from "lucide-react";

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Active") return "default";
  if (status === "Inactive") return "outline";
  return "secondary";
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}


/** A labelled value row; hidden when there is no value (keeps cards tidy). */
function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

async function fetchArray<T>(path: string): Promise<T[]> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return [];
    const body = (await res.json()) as T[] | { items?: T[] };
    return Array.isArray(body) ? body : (body.items ?? []);
  } catch {
    return [];
  }
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch in a try/catch for transport errors, but keep notFound() OUTSIDE it —
  // notFound() throws a navigation signal that must not be swallowed by the catch.
  let res: Response;
  try {
    res = await apiFetch(`/api/customers/${id}`);
  } catch {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load customer.
      </div>
    );
  }
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load customer ({res.status}).
      </div>
    );
  }
  const customer = (await res.json()) as Customer;

  // Store metadata for this customer (activity is loaded + paginated client-side).
  const [metadata] = await Promise.all([
    fetchArray<StoreMetadata>(`/api/storemetadata?filters=customerId|exact|${id}&pageSize=1`),
  ]);

  let metaJson: string | null = null;
  if (metadata[0]?.jsonData) {
    try {
      metaJson = JSON.stringify(JSON.parse(metadata[0].jsonData), null, 2);
    } catch {
      metaJson = metadata[0].jsonData;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-sm text-muted-foreground hover:underline">
          ← Back to customers
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {customer.businessName || customer.contactName}
            </h1>
            <Badge variant={statusVariant(customer.status)}>{customer.status}</Badge>
          </div>
          <Can permission="customers:update">
            <Link
              href={`/customers/${customer.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil /> Edit
            </Link>
          </Can>
        </div>
        <p className="text-sm text-muted-foreground">Member {customer.memberId}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Field label="Contact name" value={customer.contactName} />
            <Field label="Title" value={customer.personTitle} />
            <Field label="Business" value={customer.businessName} />
            <Field label="Corporate" value={customer.corpName} />
            <Field label="Email" value={customer.email} />
            <Field label="Store phone" value={customer.storePhone} />
            <Field label="Cell phone" value={customer.cellPhone} />
            <Field label="Fax" value={customer.storeFax} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Store location</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Field label="Address" value={customer.storeAddress} />
            <Field label="City" value={customer.storeCity} />
            <Field label="State" value={customer.storeState} />
            <Field label="ZIP" value={customer.storeZipcode} />
            <Field
              label="Mailing"
              value={[customer.mailingAddress, customer.mailingCity, customer.mailingState, customer.mailingZipcode]
                .filter(Boolean)
                .join(", ")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Territory</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Field label="Region" value={customer.region} />
            <Field label="District" value={customer.district} />
            <Field label="Zone no." value={customer.zoneNo} />
            <Field label="Zone manager" value={customer.zoneManager} />
            <Field label="Store group" value={customer.storeGroup} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status &amp; identifiers</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Field label="Status" value={customer.status} />
            <Field label="Date joined" value={fmtDate(customer.dateJoined)} />
            <Field label="Date inactive" value={customer.dateInactive ? fmtDate(customer.dateInactive) : null} />
            <Field label="Inactive reason" value={customer.inactiveReason} />
            <Field label="Sales tax ID" value={customer.salesTaxId} />
            <Field label="Federal tax ID" value={customer.federalTaxId} />
            <Field label="Signed by" value={customer.signedBy} />
          </CardContent>
        </Card>
      </div>

      {customer.comments && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{customer.comments}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Store metadata (equipment / footprint)</CardTitle>
        </CardHeader>
        <CardContent>
          {metaJson ? (
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{metaJson}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">No store metadata recorded.</p>
          )}
        </CardContent>
      </Card>

      <CustomerPhotos memberId={customer.memberId} customerId={customer.id} />

      <CustomerActivity customerId={customer.id} />
    </div>
  );
}
