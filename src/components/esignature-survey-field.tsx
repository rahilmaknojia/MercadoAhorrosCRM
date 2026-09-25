"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { complianceSectionTitle, formatExample, isComplianceField } from "@/lib/esign-survey";
import type {
  EsignatureMergeTokenMapping,
  EsignatureReviewSelection,
  SurveyField,
  SurveyFieldCatalog,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Located = { field: SurveyField; group: string; section: string | null };

/** The picker sub-heading: the API's `section`, else (compliance) derived from the key. */
function sectionOf(f: SurveyField): string | null {
  if (f.section) return f.section;
  return isComplianceField(f.key) ? complianceSectionTitle(f.key) ?? "Review" : null;
}

/** Every catalog field with its group label and section, in catalog order. */
function flatten(catalog: SurveyFieldCatalog): Located[] {
  const out: Located[] = [];
  for (const g of catalog.groups) {
    // Group-by keeps first-seen order so section headers never repeat even if the API
    // interleaves sections (Compliance Review is sub-grouped by section).
    const bySection = new Map<string, Located[]>();
    for (const f of g.fields) {
      const section = sectionOf(f);
      const list = bySection.get(section ?? "") ?? [];
      list.push({ field: f, group: g.label, section });
      bySection.set(section ?? "", list);
    }
    for (const list of bySection.values()) out.push(...list);
  }
  return out;
}

export function findSurveyField(catalog: SurveyFieldCatalog | null, key?: string): Located | null {
  if (!catalog || !key) return null;
  for (const g of catalog.groups) {
    const f = g.fields.find((x) => x.key === key);
    if (f) return { field: f, group: g.label, section: sectionOf(f) };
  }
  return null;
}

/**
 * Searchable, grouped picker over the Site Survey field catalog (command-palette style: a popover
 * with a filter box, group + section headers, arrow-key navigation and Enter to pick).
 */
export function SurveyFieldPicker({
  catalog,
  value,
  onChange,
}: {
  catalog: SurveyFieldCatalog;
  value?: string;
  onChange: (field: SurveyField) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => flatten(catalog), [catalog]);
  const selected = findSurveyField(catalog, value);

  const matches = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return all;
    return all.filter((x) => {
      const hay = `${x.field.label} ${x.field.key} ${x.group} ${x.section ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [all, query]);

  function pick(f: SurveyField) {
    onChange(f);
    setOpen(false);
  }

  function scrollTo(i: number) {
    listRef.current?.querySelector(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (matches.length === 0) return;
      const next =
        e.key === "ArrowDown" ? Math.min(active + 1, matches.length - 1) : Math.max(active - 1, 0);
      setActive(next);
      scrollTo(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = matches[active];
      if (hit) pick(hit.field);
    }
  }

  // Header rows are emitted whenever the group or section changes between consecutive matches.
  const rows: ReactNode[] = [];
  let lastGroup = "";
  let lastSection: string | null = null;
  matches.forEach((m, i) => {
    if (m.group !== lastGroup) {
      rows.push(
        <div
          key={`g:${m.group}:${i}`}
          className="sticky top-0 z-10 bg-popover px-2 pt-2 pb-1 text-xs font-semibold text-foreground"
        >
          {m.group}
        </div>
      );
      lastGroup = m.group;
      lastSection = null;
    }
    if (m.section && m.section !== lastSection) {
      rows.push(
        <div key={`s:${m.group}:${m.section}:${i}`} className="px-2 pt-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground">
          {m.section}
        </div>
      );
    }
    lastSection = m.section;
    const isSel = m.field.key === value;
    rows.push(
      <button
        key={m.field.key}
        type="button"
        role="option"
        aria-selected={isSel}
        data-index={i}
        onMouseMove={() => setActive(i)}
        onClick={() => pick(m.field)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
          m.section && "pl-4",
          i === active ? "bg-muted" : "hover:bg-muted/60"
        )}
      >
        <Check className={cn("size-3.5 shrink-0", isSel ? "opacity-100" : "opacity-0")} />
        <span className="min-w-0 flex-1 truncate">{m.field.label}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{m.field.kind}</span>
      </button>
    );
  });

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <PopoverPrimitive.Trigger
        render={
          <Button variant="outline" className="h-9 w-full justify-between gap-2 px-2.5 font-normal" />
        }
      >
        <span className={cn("min-w-0 truncate text-left", !value && "text-muted-foreground")}>
          {selected ? (
            <>
              {selected.field.label}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {selected.section ?? selected.group}
              </span>
            </>
          ) : value ? (
            <span className="text-destructive">Unknown field: {value}</span>
          ) : (
            "Pick a site survey field…"
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-50 outline-none" align="start" sideOffset={4}>
          <PopoverPrimitive.Popup
            initialFocus={inputRef}
            className="w-(--anchor-width) min-w-72 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"
          >
            <div className="flex items-center gap-2 border-b px-2 py-1.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                placeholder="Search fields…"
                aria-label="Search site survey fields"
                className="h-7 border-0 px-0 focus-visible:ring-0 dark:bg-transparent"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
              />
            </div>
            <div ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-1">
              {matches.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matching fields.</p>
              ) : (
                rows
              )}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * The `siteSurvey` source editor for one merge token: field picker, Format (flag/answer fields)
 * and "Which review" (compliance fields). Changing the field drops a format/selection the new
 * field doesn't allow, so the template save never trips the API's validation.
 */
export function SurveyTokenEditor({
  catalog,
  token,
  onPatch,
}: {
  catalog: SurveyFieldCatalog | null;
  token: EsignatureMergeTokenMapping;
  onPatch: (next: Partial<EsignatureMergeTokenMapping>) => void;
}) {
  if (!catalog || catalog.groups.length === 0) {
    return (
      <p className="text-xs text-destructive">
        Couldn&apos;t load the site survey field list. {token.field ? `Mapped to ${token.field}.` : ""}
      </p>
    );
  }

  const located = findSurveyField(catalog, token.field);
  const field = located?.field ?? null;
  const formats = (field?.formats ?? [])
    .map((k) => catalog.formats.find((f) => f.key === k))
    .filter((f): f is NonNullable<typeof f> => !!f);
  const defaultFormat = catalog.formats.find((f) => f.key === field?.defaultFormat) ?? formats[0];

  function pickField(f: SurveyField) {
    onPatch({
      field: f.key,
      format: token.format && f.formats?.includes(token.format) ? token.format : undefined,
      reviewSelection: f.supportsReviewSelection ? token.reviewSelection : undefined,
    });
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-xs font-medium">Site survey field</label>
        <SurveyFieldPicker catalog={catalog} value={token.field} onChange={pickField} />
      </div>
      {(formats.length > 0 || field?.supportsReviewSelection) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {formats.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Format</label>
              <select
                className={`${selectClass} w-full`}
                value={token.format ?? ""}
                onChange={(e) => onPatch({ format: e.target.value || undefined })}
              >
                {defaultFormat && (
                  <option value="">
                    Default — {defaultFormat.label} ({formatExample(defaultFormat)})
                  </option>
                )}
                {formats.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label} ({formatExample(f)})
                  </option>
                ))}
              </select>
              {field?.kind === "answer" && (
                <p className="text-[11px] text-muted-foreground">Unanswered questions are left blank.</p>
              )}
            </div>
          )}
          {field?.supportsReviewSelection && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Which review</label>
              <select
                className={`${selectClass} w-full`}
                value={token.reviewSelection ?? "latest_submitted"}
                onChange={(e) =>
                  onPatch({
                    reviewSelection:
                      e.target.value === "latest" ? ("latest" as EsignatureReviewSelection) : undefined,
                  })
                }
              >
                <option value="latest_submitted">Most recent submitted (default)</option>
                <option value="latest">Current, including drafts</option>
              </select>
              <p className="text-[11px] text-muted-foreground">The sender can pin another submitted version.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
