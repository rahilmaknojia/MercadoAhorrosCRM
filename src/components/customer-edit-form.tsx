"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateCustomer, type EditState } from "@/app/(app)/customers/[id]/edit/actions";
import type { Customer } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required = false,
  suggestions,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  suggestions?: string[];
}) {
  const listId = suggestions?.length ? `${name}-list` : undefined;
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        list={listId}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// API DateTime -> yyyy-MM-dd for <input type="date">.
function dateValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function CustomerEditForm({
  customer,
  suggestions,
}: {
  customer: Customer;
  suggestions?: Partial<Record<string, string[]>>;
}) {
  const action = updateCustomer.bind(null, String(customer.id));
  const [state, formAction, pending] = useActionState<EditState, FormData>(action, {});
  const s = suggestions ?? {};

  return (
    <form action={formAction} className="space-y-8">
      <Section title="Contact">
        <Field name="contactName" label="Contact name" defaultValue={customer.contactName} required />
        <Field name="personTitle" label="Title" defaultValue={customer.personTitle} />
        <Field name="businessName" label="Business name" defaultValue={customer.businessName} />
        <Field name="corpName" label="Corporate name" defaultValue={customer.corpName} />
        <Field name="email" label="Email" type="email" defaultValue={customer.email} />
        <Field name="storePhone" label="Store phone" defaultValue={customer.storePhone} />
        <Field name="cellPhone" label="Cell phone" defaultValue={customer.cellPhone} />
        <Field name="storeFax" label="Fax" defaultValue={customer.storeFax} />
      </Section>

      <Section title="Store location">
        <Field name="storeAddress" label="Street address" defaultValue={customer.storeAddress} />
        <Field name="storeCity" label="City" defaultValue={customer.storeCity} />
        <Field name="storeState" label="State" defaultValue={customer.storeState} />
        <Field name="storeZipcode" label="ZIP code" defaultValue={customer.storeZipcode} />
      </Section>

      <Section title="Mailing address">
        <Field name="mailingAddress" label="Street address" defaultValue={customer.mailingAddress} />
        <Field name="mailingCity" label="City" defaultValue={customer.mailingCity} />
        <Field name="mailingState" label="State" defaultValue={customer.mailingState} />
        <Field name="mailingZipcode" label="ZIP code" defaultValue={customer.mailingZipcode} />
      </Section>

      <Section title="Territory">
        <Field name="region" label="Region" defaultValue={customer.region} suggestions={s.region} />
        <Field name="district" label="District" defaultValue={customer.district} suggestions={s.district} />
        <Field name="zoneNo" label="Zone no." defaultValue={customer.zoneNo} suggestions={s.zoneNo} />
        <Field name="zoneManager" label="Zone manager" defaultValue={customer.zoneManager} suggestions={s.zoneManager} />
        <Field name="storeGroup" label="Store group" defaultValue={customer.storeGroup} suggestions={s.storeGroup} />
      </Section>

      <Section title="Status &amp; identifiers">
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={customer.status}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <Field name="dateJoined" label="Date joined" type="date" defaultValue={dateValue(customer.dateJoined)} />
        <Field name="dateInactive" label="Date inactive" type="date" defaultValue={dateValue(customer.dateInactive)} />
        <Field name="inactiveReason" label="Inactive reason" defaultValue={customer.inactiveReason} />
        <Field name="salesTaxId" label="Sales tax ID" defaultValue={customer.salesTaxId} />
        <Field name="federalTaxId" label="Federal tax ID" defaultValue={customer.federalTaxId} />
        <Field name="signedBy" label="Signed by" defaultValue={customer.signedBy} />
      </Section>

      <div className="space-y-1">
        <Label htmlFor="comments">Comments</Label>
        <textarea
          id="comments"
          name="comments"
          defaultValue={customer.comments ?? ""}
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
        <Link href={`/customers/${customer.id}`} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
