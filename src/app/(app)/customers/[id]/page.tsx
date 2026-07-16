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
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Can } from "@/components/permissions-provider";
import { CustomerPhotos } from "@/components/customer-photos";
import { CustomerActivity } from "@/components/customer-activity";
import { CustomerCoolers } from "@/components/customer-coolers";
import { CustomerVendors } from "@/components/customer-vendors";
import { MemberTabs } from "@/components/member-tabs";
import { CopyButton, CopyField } from "@/components/copy-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, formatPhone } from "@/lib/utils";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageSquare,
  Pencil,
  Store,
  User,
  type LucideIcon,
} from "lucide-react";

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
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function initials(value?: string | null): string {
  const source = (value || "?").trim();
  const [a, b] = source.split(/\s+/);
  return ((a?.[0] ?? "") + (b?.[0] ?? "")).toUpperCase() || source[0]?.toUpperCase() || "?";
}

/** A titled card with a tinted leading icon — the shared shape for the overview sections. */
function InfoCard({
  icon: Icon,
  title,
  children,
  contentClassName,
  iconClassName,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
  iconClassName?: string;
}) {
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-lg",
              iconClassName ?? "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
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

/**
 * The adjacent member in record order (by Id, which matches the list's memberId ordering) so the
 * detail page can offer prev/next. The entity filter has no `>`/`<`, so we bracket with `between`
 * and take the single nearest row; state scoping is applied by the endpoint, so neighbours stay
 * within what the viewer may see. Returns null at the ends of the list.
 */
async function fetchNeighbor(id: number, direction: "prev" | "next"): Promise<Customer | null> {
  const filter =
    direction === "next" ? `id|between|${id + 1}|2147483647` : `id|between|0|${id - 1}`;
  const params = new URLSearchParams({
    pageNumber: "1",
    pageSize: "1",
    sortField: "id",
    ascending: direction === "next" ? "true" : "false",
  });
  params.append("filters", filter);
  const rows = await fetchArray<Customer>(`/api/customers?${params.toString()}`);
  return rows[0] ?? null;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

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
  const [metadata, vendorGroups, brands, packages, sharedCoolers, prevMember, nextMember] =
    await Promise.all([
      fetchArray<StoreMetadata>(`/api/storemetadata?filters=customerId|exact|${id}&pageSize=1`),
      fetchArray<CustomerVendorSelectionGroup>(`/api/customers/${id}/vendors`),
      fetchArray<MasterDataItem>(`/api/masterdata/by-type?type=coolerBrand`),
      fetchArray<MasterDataItem>(`/api/masterdata/by-type?type=coolerPackage`),
      fetchArray<MasterDataItem>(`/api/masterdata/by-type?type=sharedCooler`),
      fetchNeighbor(customer.id, "prev"),
      fetchNeighbor(customer.id, "next"),
    ]);

  // Carry the active tab onto the prev/next links so stepping through members keeps you on the
  // same tab. Built once here; the ends of the list render as disabled controls.
  const neighborHref = (nid: number) => `/customers/${nid}${tab ? `?tab=${tab}` : ""}`;

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
        <InfoCard icon={User} title="Contact" contentClassName="divide-y" iconClassName="bg-blue-50 text-blue-600">
          <CopyField label="Contact name" value={customer.contactName} />
          <Field label="Title" value={customer.personTitle} />
          <CopyField label="Business" value={customer.businessName} />
          <CopyField label="Corporate" value={customer.corpName} />
          <CopyField label="Email" value={customer.email} />
          <CopyField label="Store phone" value={formatPhone(customer.storePhone) || customer.storePhone} />
          <CopyField label="Cell phone" value={formatPhone(customer.cellPhone) || customer.cellPhone} />
          <Field label="Fax" value={formatPhone(customer.storeFax) || customer.storeFax} />
        </InfoCard>

        <InfoCard icon={Store} title="Store information" contentClassName="divide-y" iconClassName="bg-amber-50 text-amber-600">
          <CopyField label="Address" value={customer.storeAddress} />
          <Field label="City" value={customer.storeCity} />
          <Field label="State" value={customer.storeState} />
          <Field label="ZIP" value={customer.storeZipcode} />
          <CopyField
            label="Mailing"
            value={[customer.mailingAddress, customer.mailingCity, customer.mailingState, customer.mailingZipcode]
              .filter(Boolean)
              .join(", ")}
          />
          <Field label="Sales tax ID" value={customer.salesTaxId} />
          <Field label="Federal tax ID" value={customer.federalTaxId} />
        </InfoCard>

        <InfoCard icon={MapPin} title="Territory" contentClassName="divide-y" iconClassName="bg-emerald-50 text-emerald-600">
          <Field label="Region" value={customer.region} />
          <Field label="District" value={customer.district} />
          <Field label="Zone no." value={customer.zoneNo} />
          <Field label="Zone manager" value={customer.zoneManager} />
          <Field label="Store group" value={customer.storeGroup} />
        </InfoCard>

        <InfoCard icon={BadgeCheck} title="Status &amp; identifiers" contentClassName="divide-y" iconClassName="bg-violet-50 text-violet-600">
          <Field label="Status" value={customer.status} />
          <Field label="Date joined" value={fmtDate(customer.dateJoined)} />
          <Field label="Date inactive" value={customer.dateInactive ? fmtDate(customer.dateInactive) : null} />
          <Field label="Inactive reason" value={customer.inactiveReason} />
          <Field label="Signed by" value={customer.signedBy} />
        </InfoCard>
      </div>

      {customer.comments && (
        <InfoCard icon={MessageSquare} title="Comments">
          <p className="whitespace-pre-wrap text-sm">{customer.comments}</p>
        </InfoCard>
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
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-12 shrink-0 border">
              <AvatarFallback className="text-sm font-medium">
                {initials(customer.businessName || customer.contactName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold">
                  {customer.businessName || customer.contactName}
                </h1>
                <StatusBadge status={customer.status} />
              </div>
            <p className="mt-0.5 flex flex-wrap items-center text-sm text-muted-foreground">
              <span className="group inline-flex items-center gap-1 font-medium">
                {customer.memberId}
                <CopyButton
                  value={customer.memberId}
                  label="member ID"
                  className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                />
              </span>
              {summary.map((part) => (
                <span key={part} className="inline-flex items-center">
                  <span className="px-1.5 text-border">·</span>
                  {part}
                </span>
              ))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Step through members in list order; disabled at the ends. */}
            <div className="flex items-center">
              {prevMember ? (
                <Link
                  href={neighborHref(prevMember.id)}
                  aria-label={`Previous member ${prevMember.memberId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-r-none")}
                >
                  <ChevronLeft /> Prev
                </Link>
              ) : (
                <span
                  aria-disabled
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "pointer-events-none rounded-r-none opacity-50"
                  )}
                >
                  <ChevronLeft /> Prev
                </span>
              )}
              {nextMember ? (
                <Link
                  href={neighborHref(nextMember.id)}
                  aria-label={`Next member ${nextMember.memberId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "-ml-px rounded-l-none")}
                >
                  Next <ChevronRight />
                </Link>
              ) : (
                <span
                  aria-disabled
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "pointer-events-none -ml-px rounded-l-none opacity-50"
                  )}
                >
                  Next <ChevronRight />
                </span>
              )}
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
      </div>

      <MemberTabs
        initialTab={tab}
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
