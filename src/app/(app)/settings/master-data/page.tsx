import { apiFetch } from "@/lib/server/api";
import { authApiFetch } from "@/lib/server/auth-api";
import { MANAGED_MASTER_DATA_TYPES, type AdminUser, type MasterDataItem } from "@/lib/types";
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

/** Users a zone manager can be linked to. Only owners/admins may list users; others get none. */
async function fetchUsers(): Promise<AdminUser[]> {
  try {
    const res = await authApiFetch("/api/auth/admin/list-users?limit=500&sortBy=name&sortDirection=asc");
    if (!res.ok) return [];
    const body = (await res.json()) as { users?: AdminUser[] };
    return (body.users ?? []).filter((u) => !u.banned);
  } catch {
    return [];
  }
}

export default async function MasterDataPage() {
  const [entries, users] = await Promise.all([
    Promise.all(MANAGED_MASTER_DATA_TYPES.map(async ({ type }) => [type, await fetchType(type)] as const)),
    fetchUsers(),
  ]);
  const itemsByType = Object.fromEntries(entries) as Record<string, MasterDataItem[]>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Master data</h1>
        <p className="text-sm text-muted-foreground">
          Curated territory values (which power the customer form&apos;s suggestions) and cooler
          catalogue values (which power the cooler picker). Disabling hides a value from new
          selections without affecting customers that already use it. Renaming is safe — stored
          data tracks each value by its code, not its label.
        </p>
      </div>
      <MasterDataManager itemsByType={itemsByType} users={users} />
    </div>
  );
}
