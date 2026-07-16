import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import {
  COOLER_TYPES,
  type CoolerDocument,
  type Customer,
  type CustomerVendorSelectionGroup,
  type MasterDataItem,
  type StoreMetadata,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/permissions-provider";
import { CustomerPhotos } from "@/components/customer-photos";
import { CustomerActivity } from "@/components/customer-activity";
import { CustomerCoolers } from "@/components/customer-coolers";
import { CustomerVendors } from "@/components/customer-vendors";
import { MemberTabs } from "@/components/member-tabs";
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

  // Store metadata, the cooler catalogue and vendor selections (activity is loaded + paginated
  // client-side). The catalogue drives the cooler dropdowns; inactive values are excluded so they
  // can't be newly selected, but existing selections still render (see CatalogueSelect).
  const [metadata, vendorGroups, brands, packages, sharedCoolers] = await Promise.all([
    fetchArray<StoreMetadata>(`/api/storemetadata?filters=customerId|exact|${id}&pageSize=1`),
    fetchArray<CustomerVendorSelectionGroup>(`/api/customers/${id}/vendors`),
    fetchArray<MasterDataItem>(`/api/masterdata/by-type?type=coolerBrand`),
    fetchArray<MasterDataItem>(`/api/masterdata/by-type?type=coolerPackage`),
    fetchArray<MasterDataItem>(`/api/masterdata/by-type?type=sharedCooler`),
  ]);

  // The document holds several recognized sections plus a long tail of free-form equipment keys.
  // Pull out the sections that now have real UI (and the reserved photo-caption key), and keep
  // the raw view as a fallback for whatever is left, so nothing becomes invisible.
  let metaJson: string | null = null;
  let photoCaptions: Record<string, string> = {};
  let coolerDoc: CoolerDocument = {};
  if (metadata[0]?.jsonData) {
    try {
      const parsed = JSON.parse(metadata[0].jsonData) as Record<string, unknown>;
      photoCaptions = (parsed.__photoCaptions as Record<string, string>) ?? {};
      coolerDoc = {
        coolers: parsed.coolers as CoolerDocument["coolers"],
        shared_coolers: parsed.shared_coolers as CoolerDocument["shared_coolers"],
        cold_vaults: parsed.cold_vaults as CoolerDocument["cold_vaults"],
      };
      const rest: Record<string, unknown> = { ...parsed };
      for (const key of ["__photoCaptions", "coolers", "shared_coolers", "cold_vaults"]) {
        delete rest[key];
      }
      metaJson = Object.keys(rest).length ? JSON.stringify(rest, null, 2) : null;
    } catch {
      metaJson = metadata[0].jsonData;
    }
  }

  // Counts shown on the tab labels so the page advertises what's inside before you click.
  const coolerCount = COOLER_TYPES.reduce(
    (total, { key }) =>
      total +
      Object.values(coolerDoc.coolers?.[key] ?? {}).reduce(
        (n, packages) => n + Object.keys(packages ?? {}).length,
        0
      ),
    0
  );
  const vendorCount = vendorGroups.reduce(
    (n, g) => n + g.vendors.filter((v) => v.isSelected).length,
    0
  );

  // The facts worth seeing without opening a tab: who/where/which territory.
  const summary = [
    [customer.storeCity, customer.storeState].filter(Boolean).join(", "),
    customer.region,
    customer.contactName,
  ].filter(Boolean);

  const overview = (
    <>
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

      {/* Whatever else lives in the document and has no dedicated UI yet. */}
      {metaJson && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other store metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{metaJson}</pre>
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {/* Sticky so the member you're looking at, and Edit, stay reachable while scrolling a tab. */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Link href="/customers" className="text-xs text-muted-foreground hover:underline">
          ← Back to customers
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold">
                {customer.businessName || customer.contactName}
              </h1>
              <Badge variant={statusVariant(customer.status)}>{customer.status}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {customer.memberId}
              {summary.map((part) => (
                <span key={part}>
                  <span className="px-1.5 text-border">·</span>
                  {part}
                </span>
              ))}
            </p>
          </div>
          <Can permission="customers:update">
            <Link
              href={`/customers/${customer.id}/edit`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil /> Edit
            </Link>
          </Can>
        </div>
      </div>

      <MemberTabs
        tabs={[
          { value: "overview", label: "Overview", content: overview },
          {
            value: "equipment",
            label: "Vendors & coolers",
            count: vendorCount + coolerCount,
            content: (
              <>
                <CustomerVendors customerId={customer.id} groups={vendorGroups} />
                <CustomerCoolers
                  customerId={customer.id}
                  document={coolerDoc}
                  brands={brands}
                  packages={packages}
                  sharedCoolers={sharedCoolers}
                />
              </>
            ),
          },
          {
            value: "photos",
            label: "Photos",
            content: (
              <CustomerPhotos
                memberId={customer.memberId}
                customerId={customer.id}
                initialCaptions={photoCaptions}
              />
            ),
          },
          {
            value: "activity",
            label: "Activity",
            content: <CustomerActivity customerId={customer.id} />,
          },
        ]}
      />
    </div>
  );
}
