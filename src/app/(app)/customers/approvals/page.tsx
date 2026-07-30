import Link from "next/link";
import { apiFetch } from "@/lib/server/api";
import type { Customer } from "@/lib/types";
import { ApprovalsTable } from "@/components/approvals-table";

async function fetchAwaiting(): Promise<Customer[]> {
  try {
    const res = await apiFetch("/api/customers/awaiting-approval?pageNumber=1&pageSize=100");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as Customer[]) : [];
  } catch {
    return [];
  }
}

export default async function ApprovalsPage() {
  const members = await fetchAwaiting();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Member approvals</h1>
          <p className="text-sm text-muted-foreground">
            Members awaiting approval. Approving one generates its MA member ID and activates it.
          </p>
        </div>
        <Link href="/customers" className="text-sm text-muted-foreground hover:underline">
          ← Back to customers
        </Link>
      </div>
      <ApprovalsTable members={members} />
    </div>
  );
}
