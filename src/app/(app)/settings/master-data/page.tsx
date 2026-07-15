import { apiFetch } from "@/lib/server/api";
import { MANAGED_MASTER_DATA_TYPES, type MasterDataItem } from "@/lib/types";
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
    MANAGED_MASTER_DATA_TYPES.map(async ({ type }) => [type, await fetchType(type)] as const)
  );
  const itemsByType = Object.fromEntries(entries) as Record<string, MasterDataItem[]>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Master data</h1>
        <p className="text-sm text-muted-foreground">
          Curated territory values (which power the customer form&apos;s suggestions) and cooler
          catalogue values (which power the cooler picker). Disabling hides a value from new
          selections without affecting customers that already use it. Renaming is safe — stored
          data tracks each value by its code, not its label.
        </p>
      </div>
      <MasterDataManager itemsByType={itemsByType} />
    </div>
  );
}
