"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCoolerSection } from "@/app/(app)/customers/[id]/cooler-actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  COOLER_TYPES,
  type CoolerDocument,
  type CoolerRow,
  type CoolerTypeKey,
  type MasterDataItem,
} from "@/lib/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Flatten coolers.<type>.<brand>.<package> = true into one editable row per combination. */
function toRows(doc: CoolerDocument): CoolerRow[] {
  const rows: CoolerRow[] = [];
  for (const { key } of COOLER_TYPES) {
    const byBrand = doc.coolers?.[key] ?? {};
    for (const [brand, packages] of Object.entries(byBrand)) {
      for (const pkg of Object.keys(packages ?? {})) {
        rows.push({ coolerType: key, brand, package: pkg });
      }
    }
  }
  return rows;
}

export function CustomerCoolers({
  customerId,
  document: doc,
  brands,
  packages,
  sharedCoolers,
}: {
  customerId: number;
  document: CoolerDocument;
  brands: MasterDataItem[];
  packages: MasterDataItem[];
  sharedCoolers: MasterDataItem[];
}) {
  const canEdit = useCan("customer_data:update");
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<CoolerRow[]>(() => toRows(doc));
  const [sharedNotes, setSharedNotes] = useState(doc.shared_coolers?.notes ?? "");
  const [sharedSelected, setSharedSelected] = useState<string[]>(
    () => Object.keys(doc.shared_coolers?.selected ?? {})
  );
  const [coldVaults, setColdVaults] = useState({
    no_of_cold_vault: doc.cold_vaults?.no_of_cold_vault?.toString() ?? "",
    no_of_carb_doors: doc.cold_vaults?.no_of_carb_doors?.toString() ?? "",
    no_of_non_carb_doors: doc.cold_vaults?.no_of_non_carb_doors?.toString() ?? "",
  });

  function save() {
    startTransition(async () => {
      const res = await saveCoolerSection(customerId, {
        rows,
        sharedNotes,
        sharedSelected,
        coldVaults,
      });
      if (res.ok) toast.success("Coolers saved.");
      else toast.error(res.error ?? "Failed to save coolers.");
    });
  }

  const readOnly = !canEdit || pending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Coolers &amp; cold vaults</CardTitle>
        {canEdit && (
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save coolers
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {COOLER_TYPES.map(({ key, label }) => (
          <CoolerTypeTable
            key={key}
            coolerType={key}
            label={label}
            rows={rows.filter((r) => r.coolerType === key)}
            brands={brands}
            packages={packages}
            readOnly={readOnly}
            canEdit={canEdit}
            onAdd={() =>
              setRows((p) => [
                ...p,
                { coolerType: key, brand: brands[0]?.code ?? "", package: packages[0]?.code ?? "" },
              ])
            }
            onChange={(indexWithinType, patch) =>
              setRows((p) => {
                let seen = -1;
                return p.map((r) => {
                  if (r.coolerType !== key) return r;
                  seen += 1;
                  return seen === indexWithinType ? { ...r, ...patch } : r;
                });
              })
            }
            onRemove={(indexWithinType) =>
              setRows((p) => {
                let seen = -1;
                return p.filter((r) => {
                  if (r.coolerType !== key) return true;
                  seen += 1;
                  return seen !== indexWithinType;
                });
              })
            }
          />
        ))}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Shared cooler combination</h3>
          {sharedCoolers.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-3">
              {sharedCoolers.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={sharedSelected.includes(item.code)}
                    disabled={readOnly}
                    onChange={(e) =>
                      setSharedSelected((p) =>
                        e.target.checked ? [...new Set([...p, item.code])] : p.filter((c) => c !== item.code)
                      )
                    }
                  />
                  <span className="truncate">{item.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="sharedNotes">Notes</Label>
            <Input
              id="sharedNotes"
              value={sharedNotes}
              onChange={(e) => setSharedNotes(e.target.value)}
              disabled={readOnly}
              placeholder="e.g. Coke + Pepsi share the end cap"
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Cold vaults</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField
              id="no_of_cold_vault"
              label="Cold vaults"
              value={coldVaults.no_of_cold_vault}
              disabled={readOnly}
              onChange={(v) => setColdVaults((p) => ({ ...p, no_of_cold_vault: v }))}
            />
            <NumberField
              id="no_of_carb_doors"
              label="Carbonated doors"
              value={coldVaults.no_of_carb_doors}
              disabled={readOnly}
              onChange={(v) => setColdVaults((p) => ({ ...p, no_of_carb_doors: v }))}
            />
            <NumberField
              id="no_of_non_carb_doors"
              label="Non-carbonated doors"
              value={coldVaults.no_of_non_carb_doors}
              disabled={readOnly}
              onChange={(v) => setColdVaults((p) => ({ ...p, no_of_non_carb_doors: v }))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoolerTypeTable({
  coolerType,
  label,
  rows,
  brands,
  packages,
  readOnly,
  canEdit,
  onAdd,
  onChange,
  onRemove,
}: {
  coolerType: CoolerTypeKey;
  label: string;
  rows: CoolerRow[];
  brands: MasterDataItem[];
  packages: MasterDataItem[];
  readOnly: boolean;
  canEdit: boolean;
  onAdd: () => void;
  onChange: (index: number, patch: Partial<CoolerRow>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{label}</h3>
        {canEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onAdd} disabled={readOnly}>
            <Plus /> Add
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No {label.toLowerCase()} recorded.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
            <span>Cooler brand</span>
            <span>Package</span>
            <span className="w-8" />
          </div>
          {rows.map((row, i) => (
            <div key={`${coolerType}-${i}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <CatalogueSelect
                value={row.brand}
                items={brands}
                disabled={readOnly}
                ariaLabel={`${label} brand`}
                onChange={(v) => onChange(i, { brand: v })}
              />
              <CatalogueSelect
                value={row.package}
                items={packages}
                disabled={readOnly}
                ariaLabel={`${label} package`}
                onChange={(v) => onChange(i, { package: v })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${label} row`}
                disabled={readOnly}
                onClick={() => onRemove(i)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A catalogue dropdown keyed by Code. Keeps the current value selectable even if the item was
 * disabled or removed from the catalogue, so editing a row never silently rewrites another.
 */
function CatalogueSelect({
  value,
  items,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string;
  items: MasterDataItem[];
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const known = items.some((i) => i.code === value);
  return (
    <select
      className={selectClass}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      {!known && <option value={value}>{value || "Select…"}</option>}
      {items.map((item) => (
        <option key={item.id} value={item.code}>
          {item.name}
        </option>
      ))}
    </select>
  );
}

function NumberField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
