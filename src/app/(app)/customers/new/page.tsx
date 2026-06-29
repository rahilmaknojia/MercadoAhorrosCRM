import Link from "next/link";
import { CustomerForm } from "@/components/customer-form";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/customers" className="text-sm text-muted-foreground hover:underline">
          ← Back to customers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New customer</h1>
        <p className="text-sm text-muted-foreground">
          The member ID is generated automatically. Equipment/footprint details are added
          separately as store metadata.
        </p>
      </div>
      <CustomerForm />
    </div>
  );
}
