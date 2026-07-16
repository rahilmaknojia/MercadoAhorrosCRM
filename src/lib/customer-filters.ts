// Shared, framework-agnostic filter model for the members list. Kept out of the "use client"
// component so the server page can also parse URL filters into editable conditions.

/** A field filter maps to the API `filters` param; a metadata filter maps to `meta`. */
export type FilterCondition =
  | { kind: "field"; field: string; op: string; value: string }
  | { kind: "meta"; path: string; op: string; value: string };

export const META_OPS = [
  { op: "exists", label: "exists" },
  { op: "eq", label: "is" },
  { op: "contains", label: "contains" },
  { op: "gte", label: "≥" },
  { op: "lte", label: "≤" },
  { op: "gt", label: ">" },
  { op: "lt", label: "<" },
] as const;

const META_OP_SET = new Set<string>(META_OPS.map((o) => o.op));

/** Parse the URL's `filters` (field|op|value) and `meta` (path|op|value) into editable conditions. */
export function parseConditions(
  drillFilters: string[],
  metaFilters: string[]
): FilterCondition[] {
  const out: FilterCondition[] = [];
  for (const f of drillFilters) {
    const [field, op, ...rest] = f.split("|");
    if (!field || !op) continue;
    out.push({ kind: "field", field, op, value: rest.join("|") });
  }
  for (const m of metaFilters) {
    const [path, op, ...rest] = m.split("|");
    if (!path) continue;
    const normalizedOp = op && META_OP_SET.has(op) ? op : "exists";
    out.push({ kind: "meta", path, op: normalizedOp, value: rest.join("|") });
  }
  return out;
}
