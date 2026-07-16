"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { META_OPS, type FilterCondition } from "@/lib/customer-filters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";

const META_VALUE = "__meta__";

// Customer columns worth filtering on. Order = the dropdown order.
const FIELDS: { field: string; label: string }[] = [
  { field: "businessName", label: "Business name" },
  { field: "contactName", label: "Contact name" },
  { field: "memberId", label: "Member ID" },
  { field: "storeAddress", label: "Store address" },
  { field: "storeCity", label: "City" },
  { field: "storeState", label: "State" },
  { field: "storeZipcode", label: "ZIP" },
  { field: "storePhone", label: "Phone" },
  { field: "email", label: "Email" },
  { field: "status", label: "Status" },
  { field: "region", label: "Region" },
  { field: "district", label: "District" },
  { field: "storeGroup", label: "Store group" },
  { field: "zoneManager", label: "Zone manager" },
];

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
}: {
  q: string;
  initialConditions: FilterCondition[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialConditions.length > 0);
  const [conditions, setConditions] = useState<FilterCondition[]>(initialConditions);

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

  function buildUrl(list: FilterCondition[]): string {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
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

  const activeCount = initialConditions.length;

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
                    router.push(buildUrl([]));
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
