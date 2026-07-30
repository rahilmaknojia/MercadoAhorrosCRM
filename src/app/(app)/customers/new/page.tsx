import Link from "next/link";
import { apiFetch } from "@/lib/server/api";
import { MASTER_DATA_TYPES, type MasterDataItem } from "@/lib/types";
import { MemberOnboardingWizard } from "@/components/member-onboarding-wizard";

// Active master-data values per territory field, for the store step's dropdowns.
async function fetchTerritorySuggestions(): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    MASTER_DATA_TYPES.map(async ({ type, field }) => {
      try {
        const res = await apiFetch(`/api/masterdata/by-type?type=${type}`);
        if (!res.ok) return [field, []] as const;
        const items = (await res.json()) as MasterDataItem[];
        return [field, items.map((i) => i.name)] as const;
      } catch {
        return [field, []] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function fetchRequiresApproval(): Promise<boolean> {
  try {
    const res = await apiFetch("/api/settings");
    if (!res.ok) return false;
    const data = (await res.json()) as Record<string, string>;
    return (data?.["AutoGenerateMemberIdOnApproval"] ?? "false").toLowerCase() === "true";
  } catch {
    return false;
  }
}

export default async function NewCustomerPage() {
  const [suggestions, requiresApproval] = await Promise.all([
    fetchTerritorySuggestions(),
    fetchRequiresApproval(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/customers" className="text-sm text-muted-foreground hover:underline">
          ← Back to customers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Onboard a member</h1>
        <p className="text-sm text-muted-foreground">
          {requiresApproval
            ? "This member will be submitted for approval; the MA member ID is assigned once an owner or admin approves it."
            : "The MA member ID is assigned automatically when you create the member."}
        </p>
      </div>
      <MemberOnboardingWizard suggestions={suggestions} requiresApproval={requiresApproval} />
    </div>
  );
}
