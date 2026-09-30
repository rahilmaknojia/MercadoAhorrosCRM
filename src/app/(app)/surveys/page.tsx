import { apiFetch } from "@/lib/server/api";
import { hasPermission } from "@/lib/server/authz";
import { SurveyWorklistView } from "@/components/survey-worklist-view";
import type { MasterDataItem } from "@/lib/types";
import type { UserPlace } from "./actions";
import type { GeocodingStatus, RoutePlanSummary, ZoneManagerWorklist } from "@/lib/survey-worklist";

/**
 * "My surveys": the signed-in zone manager's members and whether each has had its site survey
 * this year. Report viewers (admins) can switch to any zone manager's list with `?zm=`.
 */
export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; zm?: string }>;
}) {
  const sp = await searchParams;
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : new Date().getFullYear();
  const canViewOthers = await hasPermission("reports:read");
  const zoneManagerId = canViewOthers && sp.zm && /^\d+$/.test(sp.zm) ? Number(sp.zm) : null;

  let worklist: ZoneManagerWorklist | null = null;
  let error: string | null = null;
  try {
    const res = await apiFetch(
      zoneManagerId
        ? `/api/site-surveys/zone-managers/${zoneManagerId}?year=${year}`
        : `/api/site-surveys/mine?year=${year}`
    );
    if (res.ok) worklist = (await res.json()) as ZoneManagerWorklist;
    else error = res.status === 404 ? "That zone manager was not found." : `Failed to load surveys (${res.status}).`;
  } catch {
    error = "Could not reach the API.";
  }

  // Day plans of the zone manager on screen, and how many stores are placed on the map.
  let plans: RoutePlanSummary[] = [];
  let geocoding: GeocodingStatus | null = null;
  const [plansRes, geoRes, canMovePins, placesRes] = await Promise.all([
    apiFetch(`/api/site-surveys/route-plans${zoneManagerId ? `?zoneManagerId=${zoneManagerId}` : ""}`).catch(() => null),
    apiFetch("/api/geocoding/status").catch(() => null),
    hasPermission("customers:update"),
    apiFetch("/api/me/places").catch(() => null),
  ]);
  const places: UserPlace[] = placesRes?.ok ? ((await placesRes.json()) as UserPlace[]) : [];
  if (plansRes?.ok) plans = (await plansRes.json()) as RoutePlanSummary[];
  if (geoRes?.ok) geocoding = (await geoRes.json()) as GeocodingStatus;

  let zoneManagers: MasterDataItem[] = [];
  if (canViewOthers) {
    try {
      const res = await apiFetch("/api/masterdata/by-type?type=zoneManager&includeInactive=true");
      if (res.ok) zoneManagers = (await res.json()) as MasterDataItem[];
    } catch {
      // The picker simply doesn't show.
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {zoneManagerId && worklist?.zoneManagerName ? `Surveys · ${worklist.zoneManagerName}` : "My surveys"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Every active member needs a site survey at least once a year; twice is recommended.
        </p>
      </div>

      {error || !worklist ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error ?? "Failed to load surveys."}
        </div>
      ) : (
        <SurveyWorklistView
          worklist={worklist}
          zoneManagers={zoneManagers}
          viewingZoneManagerId={zoneManagerId}
          plans={plans}
          geocoding={geocoding}
          canMovePins={canMovePins}
          places={places}
        />
      )}
    </div>
  );
}
