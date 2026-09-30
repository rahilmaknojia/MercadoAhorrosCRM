"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CheckCheck, CircleCheck, CircleDashed, ClipboardList, List, Map as MapIcon, PencilLine, Search } from "lucide-react";
import { useProgressRouter } from "@/components/navigation-progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { SurveyPlanner } from "@/components/surveys/survey-planner";
import type { UserPlace } from "@/app/(app)/surveys/actions";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatDay,
  STATUS_META,
  yearOptions,
  type GeocodingStatus,
  type MemberSurveyStatus,
  type MemberSurveyStatusCode,
  type RoutePlanSummary,
  type ZoneManagerWorklist,
} from "@/lib/survey-worklist";
import type { MasterDataItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type StatusFilter = "all" | "todo" | MemberSurveyStatusCode;
type Sort = "status" | "zip" | "member" | "oldest";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  // "Not done yet" is what a zone manager works through: not started or only a draft.
  { value: "todo", label: "Not done yet" },
  { value: "notStarted", label: "To do" },
  { value: "inProgress", label: "In progress" },
  { value: "completed", label: "Done" },
  { value: "recommendedMet", label: "Done twice" },
];

/** A zone manager's members with this year's survey status, filters and a link into each survey. */
export function SurveyWorklistView({
  worklist,
  zoneManagers,
  viewingZoneManagerId,
  plans = [],
  geocoding = null,
  canMovePins = false,
  places = [],
}: {
  worklist: ZoneManagerWorklist;
  /** All zone managers, for report viewers to switch lists (empty otherwise). */
  zoneManagers: MasterDataItem[];
  viewingZoneManagerId: number | null;
  /** Saved day plans of this zone manager. */
  plans?: RoutePlanSummary[];
  geocoding?: GeocodingStatus | null;
  /** May place pins by hand / locate stores (customers:update). */
  canMovePins?: boolean;
  /** The viewer's saved places (Office, Home) for route start/end. */
  places?: UserPlace[];
}) {
  const router = useProgressRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>("todo");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("status");
  const [view, setView] = useState<"list" | "map">("list");

  function setParam(key: string, value: string | null) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  }

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: worklist.members.length,
      todo: 0,
      notStarted: 0,
      inProgress: 0,
      completed: 0,
      recommendedMet: 0,
    };
    for (const m of worklist.members) {
      c[m.status] += 1;
      if (m.status === "notStarted" || m.status === "inProgress") c.todo += 1;
    }
    return c;
  }, [worklist.members]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = worklist.members.filter((m) => {
      if (status === "todo" && !(m.status === "notStarted" || m.status === "inProgress")) return false;
      if (status !== "all" && status !== "todo" && m.status !== status) return false;
      if (!q) return true;
      return [m.memberId, m.businessName, m.address, m.city, m.state, m.zipcode].some((v) =>
        v?.toLowerCase().includes(q)
      );
    });
    const lastSeen = (m: MemberSurveyStatus) => m.lastSurveyedOn ?? m.previousSurveyOn ?? "";
    // By ZIP (blank last), then street, so neighbouring stores sit together for planning a day's visits.
    if (sort === "zip")
      filtered.sort(
        (a, b) =>
          (a.zipcode || "~").localeCompare(b.zipcode || "~") || (a.address ?? "").localeCompare(b.address ?? "")
      );
    if (sort === "member") filtered.sort((a, b) => (a.memberId ?? "").localeCompare(b.memberId ?? "", undefined, { numeric: true }));
    if (sort === "oldest") filtered.sort((a, b) => lastSeen(a).localeCompare(lastSeen(b)));
    return filtered; // "status" keeps the API order: to do first
  }, [worklist.members, status, query, sort]);

  const t = worklist.totals;
  const switcher = zoneManagers.length > 0 && (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span className="block">Zone manager</span>
      <select
        className={selectClass}
        value={viewingZoneManagerId ?? ""}
        onChange={(e) => setParam("zm", e.target.value || null)}
      >
        <option value="">Me</option>
        {zoneManagers.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
            {z.isActive ? "" : " (inactive)"}
          </option>
        ))}
      </select>
    </label>
  );
  const yearPicker = (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span className="block">Year</span>
      <select className={selectClass} value={worklist.year} onChange={(e) => setParam("year", e.target.value)}>
        {yearOptions(worklist.year).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );

  if (worklist.zoneManagerId === null) {
    return (
      <div className="space-y-4">
        {switcher && <div className="flex flex-wrap items-end gap-3">{switcher}</div>}
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 size-6" />
          Your account isn&apos;t linked to a zone manager yet, so there&apos;s no survey list for you.
          <br />
          An admin can link you in <span className="font-medium">Settings → Master data → Zone managers</span>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        {yearPicker}
        {switcher}
      </div>

      {/* Progress toward the once-a-year requirement, and the twice-a-year recommendation. */}
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-lg font-semibold">
            {t.completed} of {t.members} member{t.members === 1 ? "" : "s"} surveyed in {worklist.year}
          </div>
          <div className="text-2xl font-semibold tabular-nums">{t.completionRate}%</div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="flex h-full">
            <div className="bg-emerald-600" style={{ width: `${t.recommendedRate}%` }} title="Surveyed twice" />
            <div
              className="bg-emerald-400"
              style={{ width: `${Math.max(0, t.completionRate - t.recommendedRate)}%` }}
              title="Surveyed once"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Required: {worklist.required}× a year · Recommended: {worklist.recommended}×
          </span>
          <span>
            {t.recommendedMet} surveyed twice ({t.recommendedRate}%)
          </span>
          {t.avgCompleteness !== null && <span>Avg completeness {t.avgCompleteness}%</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="To do" value={t.notStarted} icon={CircleDashed} iconClassName="bg-destructive/10 text-destructive" />
        <StatCard label="In progress" value={t.inProgress} icon={PencilLine} iconClassName="bg-brand-yellow/30 text-brand-yellow-foreground" />
        <StatCard label="Done" value={t.completed - t.recommendedMet} icon={CircleCheck} iconClassName="bg-emerald-50 text-emerald-600" />
        <StatCard label="Done twice" value={t.recommendedMet} icon={CheckCheck} iconClassName="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  status === f.value && "bg-background text-foreground shadow-sm"
                )}
              >
                {f.label}
                <span className="ml-1 tabular-nums opacity-70">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex rounded-lg bg-muted p-1" role="tablist" aria-label="View">
            {(
              [
                { value: "list", label: "List", icon: List },
                { value: "map", label: "Map & routes", icon: MapIcon },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground",
                  view === value && "bg-background text-foreground shadow-sm"
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search member, address, ZIP…"
              className="h-9 w-56 pl-8"
            />
          </div>
          <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="status">Sort: to do first</option>
            <option value="zip">Sort: ZIP code</option>
            <option value="member">Sort: member ID</option>
            <option value="oldest">Sort: longest since surveyed</option>
          </select>
        </div>

        {view === "map" ? (
          <SurveyPlanner
            members={rows}
            allMembers={worklist.members}
            plans={plans}
            geocoding={geocoding}
            canMovePins={canMovePins}
            zoneManagerId={viewingZoneManagerId}
            places={places}
          />
        ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Store address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last surveyed</TableHead>
                <TableHead className="text-right">This year</TableHead>
                <TableHead className="text-right">Completeness</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {worklist.members.length === 0
                      ? "No active members are assigned to this zone manager."
                      : status === "todo"
                        ? "Nothing left to do — every member has been surveyed this year. 🎉"
                        : "No members match these filters."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((m) => <WorklistRow key={m.customerId} member={m} year={worklist.year} />)
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </div>
    </div>
  );
}

function WorklistRow({ member: m, year }: { member: MemberSurveyStatus; year: number }) {
  const meta = STATUS_META[m.status];
  const href = `/customers/${m.customerId}?tab=survey`;
  const action = m.draftVersion ? "Continue draft" : m.status === "notStarted" ? "Start survey" : "View";

  return (
    <TableRow>
      <TableCell>
        <Link href={href} className="hover:underline">
          <span className="font-medium">{m.memberId || "—"}</span>{" "}
          <span className="text-muted-foreground">{m.businessName}</span>
        </Link>
      </TableCell>
      <TableCell className="text-sm">
        {m.address || m.city ? (
          <>
            <div>{m.address || "—"}</div>
            <div className="text-xs text-muted-foreground">
              {[m.city, [m.state, m.zipcode].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", meta.className)}>
          {m.status === "inProgress" && m.draftVersion ? `Draft v${m.draftVersion}` : meta.label}
        </span>
      </TableCell>
      <TableCell className="text-sm">
        {m.lastSurveyedOn ? (
          <>
            {formatDay(m.lastSurveyedOn)}
            {m.lastSurveyedBy && <span className="text-muted-foreground"> · {m.lastSurveyedBy}</span>}
          </>
        ) : m.previousSurveyOn ? (
          <span className="text-muted-foreground">
            Not in {year} · last {formatDay(m.previousSurveyOn)}
          </span>
        ) : (
          <span className="text-muted-foreground">Never surveyed</span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{m.surveysThisYear}</TableCell>
      <TableCell className="text-right tabular-nums">{m.completeness === null ? "—" : `${m.completeness}%`}</TableCell>
      <TableCell className="text-right">
        <Link
          href={href}
          className={cn(
            "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium whitespace-nowrap",
            m.status === "notStarted" || m.draftVersion
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border hover:bg-muted"
          )}
        >
          {action}
        </Link>
      </TableCell>
    </TableRow>
  );
}
