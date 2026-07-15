"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setCustomerVendors } from "@/app/(app)/customers/[id]/vendor-actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import type { CustomerVendorSelectionGroup } from "@/lib/types";

/** Selecting this clears the rest of its group — it means "carries none". */
const NOT_APPLICABLE_CODE = "na";

/**
 * The legacy Cooler tab's Preferred Vendors / Other Vendors / Ice Cream checkbox groups.
 * Groups are data-driven from the vendor catalogue's GroupName, replacing legacy's hardcoded
 * {Coke, Pepsi, One KDP, Frito Lay} partition.
 */
export function CustomerVendors({
  customerId,
  groups,
}: {
  customerId: number;
  groups: CustomerVendorSelectionGroup[];
}) {
  const canEdit = useCan("customer_data:update");
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(groups.flatMap((g) => g.vendors.filter((v) => v.isSelected).map((v) => v.vendorId)))
  );

  if (groups.length === 0) {
    return null;
  }

  function toggle(group: CustomerVendorSelectionGroup, vendorId: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!checked) {
        next.delete(vendorId);
        return next;
      }

      const vendor = group.vendors.find((v) => v.vendorId === vendorId);
      const na = group.vendors.find((v) => v.code === NOT_APPLICABLE_CODE);
      if (vendor?.code === NOT_APPLICABLE_CODE) {
        // "N/A" is exclusive: it cannot coexist with a real choice in the same group.
        for (const other of group.vendors) next.delete(other.vendorId);
      } else if (na) {
        next.delete(na.vendorId);
      }
      next.add(vendorId);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await setCustomerVendors(customerId, [...selected]);
      if (res.ok) toast.success("Vendors saved.");
      else toast.error(res.error ?? "Failed to save vendors.");
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Vendors</CardTitle>
        {canEdit && (
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save vendors
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => (
          <div key={group.groupName} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{group.groupName}</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-3 lg:grid-cols-4">
              {group.vendors.map((vendor) => (
                <label
                  key={vendor.vendorId}
                  className="flex items-center gap-2 text-sm has-[:disabled]:text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={selected.has(vendor.vendorId)}
                    disabled={!canEdit || pending}
                    onChange={(e) => toggle(group, vendor.vendorId, e.target.checked)}
                  />
                  <span className="truncate">{vendor.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
