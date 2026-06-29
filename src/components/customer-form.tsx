"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createCustomer, type CreateState } from "@/app/(app)/customers/new/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function Field({
  name,
  label,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={name} name={name} type={type} required={required} />
    </div>
  );
}

export function CustomerForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createCustomer, {});

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="contactName" label="Contact name" required />
        <Field name="businessName" label="Business name" />
        <Field name="corpName" label="Corporate name" />
        <Field name="email" label="Email" type="email" />
        <Field name="storePhone" label="Phone" />
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue="Pending"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <Field name="storeAddress" label="Street address" />
        <Field name="storeCity" label="City" />
        <Field name="storeState" label="State" />
        <Field name="storeZipcode" label="ZIP code" />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Create customer
        </Button>
        <Link href="/customers" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
