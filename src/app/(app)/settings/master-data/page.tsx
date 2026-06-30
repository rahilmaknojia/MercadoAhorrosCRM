import { apiFetch } from "@/lib/server/api";
import { MASTER_DATA_TYPES, type MasterDataItem } from "@/lib/types";
import { MasterDataManager } from "@/components/master-data-manager";

async function fetchType(type: string): Promise<MasterDataItem[]> {
  try {
    const res = await apiFetch(`/api/masterdata/by-type?type=${type}&includeInactive=true`);
    if (!res.ok) return [];
    const items = (await res.json()) as MasterDataItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export default async function MasterDataPage() {
  const entries = await Promise.all(
    MASTER_DATA_TYPES.map(async ({ type }) => [type, await fetchType(type)] as const)
  );
  const itemsByType = Object.fromEntries(entries) as Record<string, MasterDataItem[]>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Master data</h1>
        <p className="text-sm text-muted-foreground">
          Curated territory values. These power the type-ahead suggestions on the customer form.
          Disabling hides a value from suggestions without affecting customers that already use it.
        </p>
      </div>
      <MasterDataManager itemsByType={itemsByType} />
    </div>
  );
}
