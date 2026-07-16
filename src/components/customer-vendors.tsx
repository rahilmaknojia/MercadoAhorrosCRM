"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setCustomerVendors } from "@/app/(app)/customers/[id]/vendor-actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Pencil, Save, X } from "lucide-react";
import type { CustomerVendorSelectionGroup } from "@/lib/types";

/** Selecting this clears the rest of its group — it means "carries none". */
const NOT_APPLICABLE_CODE = "na";

/**
 * The legacy Cooler tab's Preferred / Other / Ice Cream vendor groups.
 *
 * Read-first: the default view lists only the vendors a store actually uses, because that is
 * what a reader wants — the previous always-editable grid rendered ~38 checkboxes to convey
 * three facts. Editing is an explicit mode with Save/Cancel, so a stray click can't change data.
 *
 * Groups come from the vendor catalogue's GroupName, replacing legacy's hardcoded
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
  const [editing, setEditing] = useState(false);
  const initial = () =>
    new Set(groups.flatMap((g) => g.vendors.filter((v) => v.isSelected).map((v) => v.vendorId)));
  const [selected, setSelected] = useState<Set<number>>(initial);

  if (groups.length === 0) return null;

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
      if (res.ok) {
        toast.success("Vendors saved.");
        setEditing(false);
      } else {
        toast.error(res.error ?? "Failed to save vendors.");
      }
    });
  }

  function cancel() {
    setSelected(initial());
    setEditing(false);
  }

  const totalSelected = selected.size;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-base">Vendors</CardTitle>
          <p className="text-xs text-muted-foreground">
            {totalSelected === 0 ? "None recorded" : `${totalSelected} selected`}
          </p>
        </div>
        {canEdit &&
          (editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
                <X /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          ))}
      </CardHeader>

      <CardContent className="space-y-4">
        {groups.map((group) => {
          const chosen = group.vendors.filter((v) => selected.has(v.vendorId));
          return (
            <div key={group.groupName} className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <h3 className="text-sm font-medium text-muted-foreground">{group.groupName}</h3>

              {editing ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-3">
                  {group.vendors.map((vendor) => (
                    <label key={vendor.vendorId} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={selected.has(vendor.vendorId)}
                        disabled={pending}
                        onChange={(e) => toggle(group, vendor.vendorId, e.target.checked)}
                      />
                      <span className="truncate">{vendor.name}</span>
                    </label>
                  ))}
                </div>
              ) : chosen.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {chosen.map((vendor) => (
                    <span
                      key={vendor.vendorId}
                      className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium"
                    >
                      {vendor.name}
                      {vendor.accountNumber && (
                        <span className="ml-1.5 text-muted-foreground">{vendor.accountNumber}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
