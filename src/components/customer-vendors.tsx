"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setCustomerVendors } from "@/app/(app)/customers/[id]/vendor-actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomerVendorSelectionGroup } from "@/lib/types";

/** Selecting this clears the rest of its group — it means "carries none". */
const NOT_APPLICABLE_CODE = "na";

/**
 * Ticking a vendor in this group opens the account-number prompt. The owner's requirement is
 * specifically "when in preferred vendor - and clicked on coke, should prompt for coke account
 * number", so only the preferred group interrupts; every other group still accepts an account
 * number inline without a modal.
 */
const PROMPTING_GROUP = "Preferred Vendors";

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
  // Off by default so the card reads as "what this store uses"; on reveals the full roster.
  const [showUnselected, setShowUnselected] = useState(false);
  const initial = () =>
    new Set(groups.flatMap((g) => g.vendors.filter((v) => v.isSelected).map((v) => v.vendorId)));
  const initialAccounts = () =>
    new Map(
      groups.flatMap((g) =>
        g.vendors
          .filter((v) => v.accountNumber)
          .map((v) => [v.vendorId, v.accountNumber!] as const)
      )
    );
  const [selected, setSelected] = useState<Set<number>>(initial);
  const [accounts, setAccounts] = useState<Map<number, string>>(initialAccounts);
  // The vendor whose account number we're prompting for, if any.
  const [prompting, setPrompting] = useState<VendorPrompt | null>(null);

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

    const vendor = group.vendors.find((v) => v.vendorId === vendorId);
    if (
      checked &&
      vendor &&
      vendor.code !== NOT_APPLICABLE_CODE &&
      group.groupName === PROMPTING_GROUP
    ) {
      setPrompting({ vendorId, name: vendor.name, value: accounts.get(vendorId) ?? "" });
    }
  }

  function setAccount(vendorId: number, value: string) {
    setAccounts((prev) => new Map(prev).set(vendorId, value));
  }

  function save() {
    startTransition(async () => {
      // Send an accountNumber for every selected vendor — "" clears a value the user emptied.
      const res = await setCustomerVendors(
        customerId,
        [...selected].map((vendorId) => ({
          vendorId,
          accountNumber: accounts.get(vendorId)?.trim() ?? "",
        }))
      );
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
    setAccounts(initialAccounts());
    setPrompting(null);
    setEditing(false);
  }

  const totalSelected = selected.size;
  // Surfaced so staff can see at a glance what still needs chasing.
  const missingAccounts = groups
    .filter((g) => g.groupName === PROMPTING_GROUP)
    .flatMap((g) => g.vendors)
    .filter(
      (v) =>
        selected.has(v.vendorId) &&
        v.code !== NOT_APPLICABLE_CODE &&
        !(accounts.get(v.vendorId) ?? "").trim()
    );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-base">Vendors</CardTitle>
          <p className="text-xs text-muted-foreground">
            {totalSelected === 0 ? "None recorded" : `${totalSelected} selected`}
          </p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
              <X /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5"
                checked={showUnselected}
                onChange={(e) => setShowUnselected(e.target.checked)}
              />
              Show unselected
            </label>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {missingAccounts.length > 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Missing account number for{" "}
            <span className="font-medium">
              {missingAccounts.map((v) => v.name).join(", ")}
            </span>
            .
          </p>
        )}

        {groups.map((group) => {
          // Read mode shows the whole group so the reader sees what's available, not just what's
          // chosen — selected vendors sort to the front and are highlighted; the rest stay muted.
          const ordered = [...group.vendors].sort(
            (a, b) => Number(selected.has(b.vendorId)) - Number(selected.has(a.vendorId))
          );
          return (
            <div key={group.groupName} className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <h3 className="text-sm font-medium text-muted-foreground">{group.groupName}</h3>

              {editing ? (
                <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 md:grid-cols-3">
                  {group.vendors.map((vendor) => {
                    const isSelected = selected.has(vendor.vendorId);
                    const takesAccount = isSelected && vendor.code !== NOT_APPLICABLE_CODE;
                    return (
                      <div key={vendor.vendorId} className="space-y-1">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={isSelected}
                            disabled={pending}
                            onChange={(e) => toggle(group, vendor.vendorId, e.target.checked)}
                          />
                          <span className="truncate">{vendor.name}</span>
                        </label>
                        {takesAccount && (
                          <Input
                            className="h-7 text-xs"
                            placeholder="Account #"
                            aria-label={`${vendor.name} account number`}
                            value={accounts.get(vendor.vendorId) ?? ""}
                            disabled={pending}
                            onChange={(e) => setAccount(vendor.vendorId, e.target.value)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                (() => {
                  const visible = showUnselected
                    ? ordered
                    : ordered.filter((v) => selected.has(v.vendorId));
                  if (visible.length === 0) {
                    return <p className="text-sm text-muted-foreground">—</p>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {visible.map((vendor) => {
                        const isSelected = selected.has(vendor.vendorId);
                        const account = accounts.get(vendor.vendorId)?.trim();
                        return (
                          <span
                            key={vendor.vendorId}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              isSelected
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-dashed border-border text-muted-foreground/70"
                            )}
                          >
                            {isSelected && <Check className="size-3 text-emerald-600" />}
                            {vendor.name}
                            {isSelected && account && (
                              <span
                                className="font-mono text-[10px] text-emerald-700/80"
                                title={`${vendor.name} account number`}
                              >
                                #{account}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          );
        })}
      </CardContent>

      {prompting && (
        <AccountNumberPrompt
          prompt={prompting}
          onCancel={() => setPrompting(null)}
          onSave={(value) => {
            setAccount(prompting.vendorId, value);
            setPrompting(null);
          }}
        />
      )}
    </Card>
  );
}

type VendorPrompt = { vendorId: number; name: string; value: string };

/**
 * Asks for a vendor's account number the moment it's ticked. Skippable — an unknown account
 * number should never block recording that the store carries the vendor; the card flags what
 * is still missing instead.
 */
function AccountNumberPrompt({
  prompt,
  onSave,
  onCancel,
}: {
  prompt: VendorPrompt;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(prompt.value);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${prompt.name} account number`}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">{prompt.name} account number</h2>
          <p className="text-xs text-muted-foreground">
            Enter this member&apos;s account number with {prompt.name}. You can skip and add it later.
          </p>
        </div>
        <Input
          autoFocus
          value={value}
          placeholder="Account #"
          aria-label={`${prompt.name} account number`}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(value);
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Skip
          </Button>
          <Button size="sm" onClick={() => onSave(value)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
