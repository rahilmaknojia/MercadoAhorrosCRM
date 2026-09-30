/**
 * Zone managers' yearly site-survey work lists (`/api/site-surveys/mine`, `.../zone-managers/{id}`,
 * `.../coverage`). Every active member must be surveyed at least once per calendar year; twice is
 * recommended. A zone manager's list is the active members assigned to them.
 */

export type LocationStatus = "located" | "pending" | "notFound" | "noAddress";

export const LOCATION_REASON: Record<Exclude<LocationStatus, "located">, string> = {
  notFound: "Address not found",
  pending: "Waiting to be located",
  noAddress: "No store address",
};

export type MemberSurveyStatusCode = "notStarted" | "inProgress" | "completed" | "recommendedMet";

export type MemberSurveyStatus = {
  customerId: number;
  memberId: string | null;
  businessName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  /** Store location (geocoded from the address); null until located. */
  latitude: number | null;
  longitude: number | null;
  /** Why the store is or isn't on the map. */
  locationStatus: LocationStatus;
  status: MemberSurveyStatusCode;
  surveysThisYear: number;
  lastSurveyedOn: string | null;
  lastSurveyedBy: string | null;
  /** Completeness (%) of the latest survey this year. */
  completeness: number | null;
  draftVersion: number | null;
  draftSavedOn: string | null;
  /** Latest survey before this year. */
  previousSurveyOn: string | null;
};

export type SurveyTotals = {
  members: number;
  completed: number;
  recommendedMet: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
  recommendedRate: number;
  avgCompleteness: number | null;
};

export type ZoneManagerWorklist = {
  year: number;
  /** Null when the viewer's account is not linked to a zone manager. */
  zoneManagerId: number | null;
  zoneManagerName: string | null;
  linkedUserName: string | null;
  required: number;
  recommended: number;
  totals: SurveyTotals;
  members: MemberSurveyStatus[];
};

export type ZoneManagerCoverageRow = {
  zoneManagerId: number | null;
  zoneManagerName: string;
  linkedUserName: string | null;
  isActive: boolean;
  totals: SurveyTotals;
};

export type ZoneManagerCoverageReport = {
  year: number;
  required: number;
  recommended: number;
  totals: SurveyTotals;
  zoneManagers: ZoneManagerCoverageRow[];
};

/** Label and pill colours per status. "Done" = met the once-a-year requirement. */
export const STATUS_META: Record<MemberSurveyStatusCode, { label: string; className: string }> = {
  notStarted: {
    label: "To do",
    className: "bg-destructive/10 text-destructive",
  },
  inProgress: {
    label: "In progress",
    className: "bg-brand-yellow/40 text-brand-yellow-foreground",
  },
  completed: {
    label: "Done",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  recommendedMet: {
    label: "Done twice",
    className: "bg-emerald-600 text-white",
  },
};

/** The years offered in pickers: this year and the two before it (plus the selected one). */
export function yearOptions(selected: number): number[] {
  const now = new Date().getFullYear();
  return [...new Set([now, now - 1, now - 2, selected])].sort((a, b) => b - a);
}

export function formatDay(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

// ---- day route plans (/api/site-surveys/route-plans) ----------------------------------------------

export type RoutePlanSummary = {
  id: number;
  name: string;
  /** yyyy-MM-dd, or null for an undated plan. */
  planDate: string | null;
  zoneManagerId: number;
  zoneManagerName: string;
  stops: number;
  /** Stops with a survey submitted on/after the plan date. */
  visited: number;
  createdOn: string;
  createdBy: string;
  /** Where the day starts / ends (e.g. office, home); null = device location / last stop. */
  start: { label: string | null; address: string | null; latitude: number; longitude: number } | null;
  end: { label: string | null; address: string | null; latitude: number; longitude: number } | null;
};

export type RoutePlanStop = { position: number; visited: boolean; visitedOn: string | null; member: MemberSurveyStatus };

export type RoutePlanDetail = { summary: RoutePlanSummary; stops: RoutePlanStop[] };

export type GeocodingStatus = { withAddress: number; located: number; pending: number; noMatch: number; manual: number };

/** Surveyed today — shown blue on the map and route until the next day. */
export const SURVEYED_TODAY_COLOR = "#2563eb";

const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

/** A store's pin colour: blue if surveyed today, else red / amber / green by this year's status. */
export const pinColor = (m: MemberSurveyStatus) =>
  isToday(m.lastSurveyedOn) ? SURVEYED_TODAY_COLOR : PIN_COLORS[m.status];

/** Pin colours: red = not done this year, amber = surveyed once, green = surveyed twice. */
export const PIN_COLORS: Record<MemberSurveyStatusCode, string> = {
  notStarted: "#dc2626",
  inProgress: "#dc2626",
  completed: "#f59e0b",
  recommendedMet: "#16a34a",
};
