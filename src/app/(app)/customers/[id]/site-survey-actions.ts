"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { SiteSurvey, SurveyOverview, SurveyVersion } from "@/lib/site-survey";

/**
 * Site survey (Coolers & Cold Vaults) server actions — thin BFF wrappers over
 * `api/customers/{id}/site-survey`. The API owns versioning, normalisation and the computed cold
 * vault total; these only shape errors for the UI.
 *
 * Saving a draft does not revalidate the page (nothing else on it changes). Submit and discard do:
 * submit rewrites the member's cooler data and writes a CustomerLog the Activity tab shows.
 */

export type SurveyResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      status: number | null;
      /** 409: someone else saved in between; this is the server's current overview. */
      conflict?: SurveyOverview;
    };

const base = (customerId: number) => `/api/customers/${customerId}/site-survey`;

const validId = (customerId: number) => Number.isInteger(customerId) && customerId > 0;

async function failure<T>(res: Response | null, fallback: string): Promise<SurveyResult<T>> {
  if (!res) return { ok: false, status: null, error: "Could not reach the API." };
  const body = (await res.json().catch(() => null)) as
    | { message?: string; title?: string; errors?: string[] | Record<string, string[]>; current?: SurveyOverview }
    | null;
  if (res.status === 409) {
    return {
      ok: false,
      status: 409,
      error: body?.message ?? "This site survey was changed by someone else.",
      conflict: body?.current,
    };
  }
  if (res.status === 403) {
    return { ok: false, status: 403, error: body?.message ?? "You do not have permission to edit site surveys." };
  }
  if (res.status === 404) return { ok: false, status: 404, error: body?.message ?? "Not found." };
  const errors = body?.errors ? Object.values(body.errors).flat() : [];
  return {
    ok: false,
    status: res.status,
    error: errors.length > 1 ? errors.join(" ") : (body?.message ?? errors[0] ?? body?.title ?? fallback),
  };
}

export async function getSiteSurvey(customerId: number): Promise<SurveyResult<SurveyOverview>> {
  if (!validId(customerId)) return { ok: false, status: null, error: "Missing customer." };
  const res = await apiFetch(base(customerId)).catch(() => null);
  if (!res?.ok) return failure(res, "Could not load the site survey.");
  return { ok: true, data: (await res.json()) as SurveyOverview };
}

export async function getSiteSurveyVersion(
  customerId: number,
  version: number
): Promise<SurveyResult<SurveyVersion>> {
  if (!validId(customerId) || !Number.isInteger(version)) return { ok: false, status: null, error: "Missing version." };
  const res = await apiFetch(`${base(customerId)}/versions/${version}`).catch(() => null);
  if (!res?.ok) return failure(res, `Could not load version ${version}.`);
  return { ok: true, data: (await res.json()) as SurveyVersion };
}

export async function saveSiteSurveyDraft(
  customerId: number,
  expectedVersion: number | null,
  survey: SiteSurvey
): Promise<SurveyResult<SurveyVersion>> {
  if (!validId(customerId)) return { ok: false, status: null, error: "Missing customer." };
  const res = await apiFetch(`${base(customerId)}/draft`, {
    method: "PUT",
    body: JSON.stringify({ expectedVersion, survey }),
  }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not save the draft.");
  return { ok: true, data: (await res.json()) as SurveyVersion };
}

/** `zoneManagerId` credits a zone manager other than the default (owner/admin only; 403 otherwise). */
export async function submitSiteSurvey(
  customerId: number,
  expectedVersion: number | null,
  survey: SiteSurvey,
  zoneManagerId: number | null = null
): Promise<SurveyResult<SurveyVersion>> {
  if (!validId(customerId)) return { ok: false, status: null, error: "Missing customer." };
  const res = await apiFetch(`${base(customerId)}/submit`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion, survey, zoneManagerId }),
  }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not submit the site survey.");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: (await res.json()) as SurveyVersion };
}

export async function discardSiteSurveyDraft(
  customerId: number,
  expectedVersion: number | null
): Promise<SurveyResult<SurveyOverview>> {
  if (!validId(customerId)) return { ok: false, status: null, error: "Missing customer." };
  const qs = expectedVersion === null ? "" : `?expectedVersion=${expectedVersion}`;
  const res = await apiFetch(`${base(customerId)}/draft${qs}`, { method: "DELETE" }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not discard the draft.");
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: (await res.json()) as SurveyOverview };
}
