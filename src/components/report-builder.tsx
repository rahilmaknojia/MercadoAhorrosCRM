"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveReport } from "@/app/(app)/reports/actions";
import { CUSTOMER_FIELDS, FILTER_OPERATORS, GROUP_FIELDS } from "@/lib/report";
import type { ReportDefinition, ReportFilterRow, ReportVisualization } from "@/lib/types";
import { ReportView } from "@/components/report-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Plus, Save, X } from "lucide-react";

const VISUALIZATIONS: { value: ReportVisualization; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "bar", label: "Bar chart" },
  { value: "pie", label: "Pie chart" },
  { value: "metric", label: "KPI metric" },
];

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ReportBuilder({
  initial,
}: {
  initial?: { id: number; name: string; description?: string | null; definition: ReportDefinition };
}) {
  const router = useRouter();
  const def = initial?.definition;

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [visualization, setVisualization] = useState<ReportVisualization>(
    def?.visualization ?? "table"
  );
  const [groupBy, setGroupBy] = useState(def?.groupBy ?? GROUP_FIELDS[0].value);
  const [series, setSeries] = useState(def?.series ?? "");
  const [columns, setColumns] = useState<string[]>(
    def?.columns ?? ["memberId", "businessName", "storeCity", "storeState", "status"]
  );
  const [filters, setFilters] = useState<ReportFilterRow[]>(
    (def?.filters ?? []).map((f) => {
      const [field, operator, ...rest] = f.split("|");
      return { field, operator, value: rest.join("|") };
    })
  );
  const [preview, setPreview] = useState<ReportDefinition | null>(def ?? null);
  const [saving, startSaving] = useTransition();

  function buildDefinition(): ReportDefinition {
    return {
      source: "customers",
      filters: filters
        .filter((f) => f.field && f.value !== "")
        .map((f) => `${f.field}|${f.operator}|${f.value}`),
      columns: visualization === "table" ? columns : undefined,
      visualization,
      groupBy: visualization === "table" ? undefined : groupBy,
      series: visualization === "bar" && series ? series : undefined,
      aggregate: "count",
      pinnedToDashboard: def?.pinnedToDashboard ?? false,
    };
  }

  function onSave() {
    startSaving(async () => {
      const res = await saveReport({
        id: initial?.id,
        name,
        description,
        definition: buildDefinition(),
      });
      if (res.ok) {
        toast.success("Report saved.");
        router.push(res.id ? `/reports/${res.id}` : "/reports");
      } else {
        toast.error(res.error ?? "Failed to save report.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Config */}
      <div className="space-y-5">
        <div className="space-y-1">
          <Label htmlFor="name">Report name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Active stores by state" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="viz">Visualization</Label>
          <select
            id="viz"
            className={selectClass}
            value={visualization}
            onChange={(e) => setVisualization(e.target.value as ReportVisualization)}
          >
            {VISUALIZATIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {visualization !== "table" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="groupBy">Group by</Label>
              <select id="groupBy" className={selectClass} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                {GROUP_FIELDS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            {visualization === "bar" && (
              <div className="space-y-1">
                <Label htmlFor="series">Series (stacked, optional)</Label>
                <select id="series" className={selectClass} value={series} onChange={(e) => setSeries(e.target.value)}>
                  <option value="">None</option>
                  {GROUP_FIELDS.filter((g) => g.value !== groupBy).map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1">
            <Label>Columns</Label>
            <div className="grid grid-cols-2 gap-1">
              {CUSTOMER_FIELDS.map((f) => (
                <label key={f.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={columns.includes(f.value)}
                    onChange={(e) =>
                      setColumns((prev) =>
                        e.target.checked ? [...prev, f.value] : prev.filter((c) => c !== f.value)
                      )
                    }
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Filters</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilters((p) => [...p, { field: CUSTOMER_FIELDS[0].value, operator: "eq", value: "" }])}
            >
              <Plus /> Add
            </Button>
          </div>
          {filters.length === 0 && <p className="text-xs text-muted-foreground">No filters (all records).</p>}
          {filters.map((row, i) => (
            <div key={i} className="flex items-center gap-1">
              <select
                className={selectClass}
                value={row.field}
                onChange={(e) =>
                  setFilters((p) => p.map((r, j) => (j === i ? { ...r, field: e.target.value } : r)))
                }
              >
                {CUSTOMER_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className={`${selectClass} w-28`}
                value={row.operator}
                onChange={(e) =>
                  setFilters((p) => p.map((r, j) => (j === i ? { ...r, operator: e.target.value } : r)))
                }
              >
                {FILTER_OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Input
                value={row.value}
                onChange={(e) =>
                  setFilters((p) => p.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                }
                placeholder="value"
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove filter"
                onClick={() => setFilters((p) => p.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setPreview(buildDefinition())}>
            <Play /> Run preview
          </Button>
          <Button type="button" onClick={onSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Save report
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="min-w-0 rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Preview</h2>
        {preview ? (
          <ReportView definition={preview} />
        ) : (
          <p className="text-sm text-muted-foreground">Configure the report and click “Run preview”.</p>
        )}
      </div>
    </div>
  );
}
