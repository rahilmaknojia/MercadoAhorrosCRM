"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCoolerSection } from "@/app/(app)/customers/[id]/cooler-actions";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
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
    for (const [brand, packages] of Object.entries(doc.coolers?.[key] ?? {})) {
      for (const pkg of Object.keys(packages ?? {})) {
        rows.push({ coolerType: key, brand, package: pkg });
      }
    }
  }
  return rows;
}

const labelOf = (items: MasterDataItem[], code: string) =>
  items.find((i) => i.code === code)?.name ?? code;

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
  const [editing, setEditing] = useState(false);

  const initialRows = () => toRows(doc);
  const initialShared = () => Object.keys(doc.shared_coolers?.selected ?? {});
  const initialVaults = () => ({
    no_of_cold_vault: doc.cold_vaults?.no_of_cold_vault?.toString() ?? "",
    no_of_carb_doors: doc.cold_vaults?.no_of_carb_doors?.toString() ?? "",
    no_of_non_carb_doors: doc.cold_vaults?.no_of_non_carb_doors?.toString() ?? "",
  });

  const [rows, setRows] = useState<CoolerRow[]>(initialRows);
  const [sharedNotes, setSharedNotes] = useState(doc.shared_coolers?.notes ?? "");
  const [sharedSelected, setSharedSelected] = useState<string[]>(initialShared);
  const [coldVaults, setColdVaults] = useState(initialVaults);

  function save() {
    startTransition(async () => {
      const res = await saveCoolerSection(customerId, { rows, sharedNotes, sharedSelected, coldVaults });
      if (res.ok) {
        toast.success("Coolers saved.");
        setEditing(false);
      } else {
        toast.error(res.error ?? "Failed to save coolers.");
      }
    });
  }

  function cancel() {
    setRows(initialRows());
    setSharedSelected(initialShared());
    setColdVaults(initialVaults());
    setSharedNotes(doc.shared_coolers?.notes ?? "");
    setEditing(false);
  }

  const vaultFields = [
    { key: "no_of_cold_vault" as const, label: "Cold vaults" },
    { key: "no_of_carb_doors" as const, label: "Carbonated doors" },
    { key: "no_of_non_carb_doors" as const, label: "Non-carbonated doors" },
  ];
  const hasVaults = vaultFields.some((f) => coldVaults[f.key] !== "");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="text-base">Coolers &amp; cold vaults</CardTitle>
          <p className="text-xs text-muted-foreground">
            {rows.length === 0 ? "None recorded" : `${rows.length} cooler${rows.length === 1 ? "" : "s"}`}
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

      <CardContent className="space-y-5">
        {COOLER_TYPES.map(({ key, label }) => {
          const typeRows = rows.filter((r) => r.coolerType === key);
          return (
            <div key={key} className="grid gap-2 sm:grid-cols-[160px_1fr]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
              </div>

              <div className="space-y-1.5">
                {editing ? (
                  <>
                    {typeRows.map((row, i) => (
                      <div key={`${key}-${i}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                        <CatalogueSelect
                          value={row.brand}
                          items={brands}
                          disabled={pending}
                          ariaLabel={`${label} brand`}
                          onChange={(v) => updateRow(setRows, key, i, { brand: v })}
                        />
                        <CatalogueSelect
                          value={row.package}
                          items={packages}
                          disabled={pending}
                          ariaLabel={`${label} package`}
                          onChange={(v) => updateRow(setRows, key, i, { package: v })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${label} row`}
                          disabled={pending}
                          onClick={() => removeRow(setRows, key, i)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        setRows((p) => [
                          ...p,
                          { coolerType: key, brand: brands[0]?.code ?? "", package: packages[0]?.code ?? "" },
                        ])
                      }
                    >
                      <Plus /> Add
                    </Button>
                  </>
                ) : typeRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {typeRows.map((row, i) => (
                      <span
                        key={`${key}-${i}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium"
                      >
                        {labelOf(brands, row.brand)}
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{labelOf(packages, row.package)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[160px_1fr]">
          <h3 className="text-sm font-medium text-muted-foreground">Shared coolers</h3>
          <div className="space-y-2">
            {editing ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-3">
                  {sharedCoolers.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={sharedSelected.includes(item.code)}
                        disabled={pending}
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
                <Input
                  value={sharedNotes}
                  onChange={(e) => setSharedNotes(e.target.value)}
                  disabled={pending}
                  placeholder="Notes, e.g. Coke + Pepsi share the end cap"
                />
              </>
            ) : sharedSelected.length === 0 && !sharedNotes ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {sharedSelected.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium"
                    >
                      {labelOf(sharedCoolers, code)}
                    </span>
                  ))}
                </div>
                {sharedNotes && <p className="text-sm text-muted-foreground">{sharedNotes}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[160px_1fr]">
          <h3 className="text-sm font-medium text-muted-foreground">Cold vaults</h3>
          {editing ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {vaultFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={coldVaults[f.key]}
                    disabled={pending}
                    onChange={(e) => setColdVaults((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          ) : !hasVaults ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {vaultFields
                .filter((f) => coldVaults[f.key] !== "")
                .map((f) => (
                  <div key={f.key} className="flex items-baseline gap-1.5">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-medium tabular-nums">{coldVaults[f.key]}</dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Rows are stored flat across cooler types, so edits address the Nth row *within* a type. */
function updateRow(
  setRows: React.Dispatch<React.SetStateAction<CoolerRow[]>>,
  type: CoolerTypeKey,
  indexWithinType: number,
  patch: Partial<CoolerRow>
) {
  setRows((p) => {
    let seen = -1;
    return p.map((r) => {
      if (r.coolerType !== type) return r;
      seen += 1;
      return seen === indexWithinType ? { ...r, ...patch } : r;
    });
  });
}

function removeRow(
  setRows: React.Dispatch<React.SetStateAction<CoolerRow[]>>,
  type: CoolerTypeKey,
  indexWithinType: number
) {
  setRows((p) => {
    let seen = -1;
    return p.filter((r) => {
      if (r.coolerType !== type) return true;
      seen += 1;
      return seen !== indexWithinType;
    });
  });
}

/**
 * A catalogue dropdown keyed by Code. Keeps the current value selectable even if the item was
 * disabled or removed from the catalogue, so editing one row never silently rewrites another.
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
