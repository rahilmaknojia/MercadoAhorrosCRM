"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { META_OPS, type FilterCondition } from "@/lib/customer-filters";
import { fieldLabel } from "@/lib/report";
import type { VendorGroup } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";

const META_VALUE = "__meta__";

// Customer columns worth filtering on. Order = the dropdown order. Labels come from the
// shared CUSTOMER_FIELDS table via fieldLabel() so filter wording matches reports and exports.
const FIELDS: { field: string; label: string }[] = [
  "businessName",
  "contactName",
  "memberId",
  "storeAddress",
  "storeCity",
  "storeState",
  "storeZipcode",
  "storePhone",
  "email",
  "status",
  "region",
  "district",
  "storeGroup",
  "zoneManager",
].map((field) => ({ field, label: fieldLabel(field) }));

const STATUS_OPTIONS = ["Active", "Pending", "Inactive"];

const TEXT_OPS = [
  { op: "contains", label: "contains" },
  { op: "exact", label: "is" },
  { op: "startswith", label: "starts with" },
];
const STATUS_OPS = [{ op: "exact", label: "is" }];

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function opsFor(c: FilterCondition) {
  if (c.kind === "meta") return META_OPS;
  return c.field === "status" ? STATUS_OPS : TEXT_OPS;
}

export function CustomerFilterBuilder({
  q,
  initialConditions,
  vendorGroups = [],
  initialVendorCodes = [],
  initialMatchAll = false,
}: {
  q: string;
  initialConditions: FilterCondition[];
  vendorGroups?: VendorGroup[];
  initialVendorCodes?: string[];
  initialMatchAll?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(
    initialConditions.length > 0 || initialVendorCodes.length > 0
  );
  const [conditions, setConditions] = useState<FilterCondition[]>(initialConditions);
  const [vendorCodes, setVendorCodes] = useState<Set<string>>(new Set(initialVendorCodes));
  const [matchAll, setMatchAll] = useState(initialMatchAll);

  function toggleVendor(code: string, checked: boolean) {
    setVendorCodes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  function toggleVendorGroup(group: VendorGroup, checked: boolean) {
    setVendorCodes((prev) => {
      const next = new Set(prev);
      for (const v of group.vendors) {
        if (checked) next.add(v.code);
        else next.delete(v.code);
      }
      return next;
    });
  }

  const patch = (i: number, next: FilterCondition) =>
    setConditions((cs) => cs.map((c, idx) => (idx === i ? next : c)));
  const remove = (i: number) => setConditions((cs) => cs.filter((_, idx) => idx !== i));
  const add = () =>
    setConditions((cs) => [...cs, { kind: "field", field: "businessName", op: "contains", value: "" }]);

  function changeField(i: number, value: string) {
    if (value === META_VALUE) {
      patch(i, { kind: "meta", path: "", op: "exists", value: "" });
    } else {
      patch(i, { kind: "field", field: value, op: value === "status" ? "exact" : "contains", value: "" });
    }
  }

  function buildUrl(list: FilterCondition[], vendors: Set<string> = vendorCodes): string {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (vendors.size > 0) {
      usp.set("vendors", [...vendors].join(","));
      if (matchAll) usp.set("vmatch", "all");
    }
    for (const c of list) {
      if (c.kind === "field") {
        if (!c.field || !c.value.trim()) continue;
        usp.append("filters", `${c.field}|${c.op}|${c.value.trim()}`);
      } else {
        if (!c.path.trim()) continue;
        usp.append(
          "meta",
          c.op === "exists" ? `${c.path.trim()}|exists` : `${c.path.trim()}|${c.op}|${c.value.trim()}`
        );
      }
    }
    const query = usp.toString();
    return query ? `/customers?${query}` : "/customers";
  }

  const activeCount = initialConditions.length + (initialVendorCodes.length > 0 ? 1 : 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <SlidersHorizontal className="size-3.5" />
        Advanced filter
        {activeCount > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {conditions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add a condition to filter members by a field.
            </p>
          )}

          {conditions.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select
                className={selectClass}
                value={c.kind === "meta" ? META_VALUE : c.field}
                onChange={(e) => changeField(i, e.target.value)}
                aria-label="Field"
              >
                {FIELDS.map((f) => (
                  <option key={f.field} value={f.field}>
                    {f.label}
                  </option>
                ))}
                <option value={META_VALUE}>Store metadata…</option>
              </select>

              {c.kind === "meta" && (
                <Input
                  value={c.path}
                  onChange={(e) => patch(i, { ...c, path: e.target.value })}
                  placeholder="path, e.g. coolers.standing.coke"
                  className="h-9 w-56"
                  aria-label="Metadata path"
                />
              )}

              <select
                className={selectClass}
                value={c.op}
                onChange={(e) => patch(i, { ...c, op: e.target.value })}
                aria-label="Operator"
              >
                {opsFor(c).map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </select>

              {/* Value: hidden for metadata "exists"; a status picker for status; text otherwise. */}
              {c.kind === "meta" && c.op === "exists" ? null : c.kind === "field" &&
                c.field === "status" ? (
                <select
                  className={selectClass}
                  value={c.value}
                  onChange={(e) => patch(i, { ...c, value: e.target.value })}
                  aria-label="Value"
                >
                  <option value="">Select…</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={c.value}
                  onChange={(e) => patch(i, { ...c, value: e.target.value })}
                  placeholder="value"
                  className="h-9 w-40"
                  aria-label="Value"
                />
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(i)}
                aria-label="Remove condition"
              >
                <Trash2 />
              </Button>
            </div>
          ))}

          {/* Vendor filter. Kept out of the condition rows because it is a multi-select over a
              related table, not a column comparison — and because "show me only Coke stores" is
              the single most-requested filter, so it deserves a fixed place in the panel. */}
          {vendorGroups.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium">Vendors</span>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-3.5"
                      checked={matchAll}
                      onChange={(e) => setMatchAll(e.target.checked)}
                    />
                    Match all selected (otherwise any)
                  </label>
                  {vendorCodes.size > 0 && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                      onClick={() => setVendorCodes(new Set())}
                    >
                      Clear vendors
                    </button>
                  )}
                </div>
              </div>

              {vendorGroups.map((group) => {
                const allChecked =
                  group.vendors.length > 0 &&
                  group.vendors.every((v) => vendorCodes.has(v.code));
                return (
                  <div key={group.groupName} className="grid gap-1 sm:grid-cols-[160px_1fr]">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5"
                        checked={allChecked}
                        onChange={(e) => toggleVendorGroup(group, e.target.checked)}
                        aria-label={`Select all ${group.groupName}`}
                      />
                      {group.groupName}
                    </label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
                      {group.vendors.map((vendor) => (
                        <label
                          key={vendor.code}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <input
                            type="checkbox"
                            className="size-3.5"
                            checked={vendorCodes.has(vendor.code)}
                            onChange={(e) => toggleVendor(vendor.code, e.target.checked)}
                          />
                          <span className="truncate">{vendor.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={add}>
              <Plus /> Add condition
            </Button>
            <div className="ml-auto flex gap-2">
              {activeCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConditions([]);
                    setVendorCodes(new Set());
                    setMatchAll(false);
                    router.push(buildUrl([], new Set()));
                  }}
                >
                  Clear
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => router.push(buildUrl(conditions))}>
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
