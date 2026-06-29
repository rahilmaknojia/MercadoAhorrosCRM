import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import type { Customer } from "@/lib/types";
import { CustomerEditForm } from "@/components/customer-edit-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // notFound() throws a navigation signal — keep it outside the transport try/catch.
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/customers/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to customer
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Edit customer</h1>
        <p className="text-sm text-muted-foreground">
          Member {customer.memberId}. Equipment/footprint is managed separately as store metadata.
        </p>
      </div>
      <CustomerEditForm customer={customer} />
    </div>
  );
}
