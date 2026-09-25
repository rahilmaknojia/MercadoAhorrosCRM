"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import {
  answersOf,
  type ComplianceAnswers,
  type ComplianceHistorySummary,
  type ComplianceReview,
  type ComplianceState,
} from "@/lib/compliance";

/**
 * Compliance Review server actions — thin BFF wrappers over
 * `api/customers/{id}/compliance-review` (spec §2.5). The API owns versioning, normalisation,
 * `issues` and the signature upload; these only shape errors for the UI.
 *
 * Draft saves deliberately do NOT revalidate the page: autosave runs every couple of seconds and
 * a revalidation would re-render the whole member page each time. The panel keeps its own state
 * from the return values. Submit and discard do revalidate (they write a CustomerLog, which the
 * Activity tab shows).
 */

export type ComplianceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      status: number | null;
      /** 409: someone else changed the review; this is the server's current copy. */
      conflict?: { current: ComplianceReview | null };
    };

const base = (customerId: number) => `/api/customers/${customerId}/compliance-review`;

function validId(customerId: number) {
  return Number.isInteger(customerId) && customerId > 0;
}

async function failure<T>(res: Response | null, fallback: string): Promise<ComplianceResult<T>> {
  if (!res) return { ok: false, status: null, error: "Could not reach the API." };
  const body = (await res.json().catch(() => null)) as
    | { message?: string; title?: string; detail?: string; errors?: string[] | Record<string, string[]>; current?: ComplianceReview | null }
    | null;
  if (res.status === 409) {
    return {
      ok: false,
      status: 409,
      error: body?.message ?? "This review was changed by someone else.",
      conflict: { current: body?.current ?? null },
    };
  }
  if (res.status === 403) {
    return { ok: false, status: 403, error: "You do not have permission to edit compliance reviews." };
  }
  if (res.status === 404) return { ok: false, status: 404, error: body?.message ?? "Not found." };
  const validation = body?.errors ? Object.values(body.errors).flat().join(" ") : "";
  return {
    ok: false,
    status: res.status,
    error: body?.message ?? (validation || body?.detail || body?.title || fallback),
  };
}

/** Parses the `{ current, history }` overview that GET and DELETE draft both return. */
async function parseState(res: Response): Promise<ComplianceResult<ComplianceState>> {
  const body = (await res.json().catch(() => null)) as Partial<ComplianceState> | null;
  return {
    ok: true,
    data: {
      current: body?.current ?? null,
      history: Array.isArray(body?.history) ? (body.history as ComplianceHistorySummary[]) : [],
    },
  };
}

async function readState(customerId: number): Promise<ComplianceResult<ComplianceState>> {
  const res = await apiFetch(base(customerId)).catch(() => null);
  if (!res?.ok) return failure(res, "Could not load compliance reviews.");
  return parseState(res);
}

/** `{ current, history }` — history newest first. */
export async function getComplianceReviews(customerId: number): Promise<ComplianceResult<ComplianceState>> {
  if (!validId(customerId)) return { ok: false, status: null, error: "Missing customer." };
  return readState(customerId);
}

/** One full review (current or archived). */
export async function getComplianceReviewVersion(
  customerId: number,
  version: number,
): Promise<ComplianceResult<ComplianceReview>> {
  if (!validId(customerId) || !Number.isInteger(version) || version < 1) {
    return { ok: false, status: null, error: "Invalid version." };
  }
  const res = await apiFetch(`${base(customerId)}/versions/${version}`).catch(() => null);
  if (!res?.ok) return failure(res, "Could not load that version.");
  return { ok: true, data: (await res.json()) as ComplianceReview };
}

export type DraftSaved = {
  review: ComplianceReview;
  /** Present when the save created a new version (a submitted review was archived), so history moved. */
  state?: ComplianceState;
};

/**
 * PUT draft. `expectedVersion` is the version the client last saw (null = "no current review").
 * No current → creates v1; current draft → replaces its answers; current submitted → archives it
 * and starts draft v{n+1} (this is how "Start new review" and "Amend" work).
 */
export async function saveComplianceDraft(
  customerId: number,
  expectedVersion: number | null,
  answers: ComplianceAnswers,
): Promise<ComplianceResult<DraftSaved>> {
  if (!validId(customerId)) return { ok: false, status: null, error: "Missing customer." };
  const res = await apiFetch(`${base(customerId)}/draft`, {
    method: "PUT",
    body: JSON.stringify({ expectedVersion, review: answersOf(answers) }),
  }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not save the draft.");
  const review = (await res.json()) as ComplianceReview;

  if (review.version !== expectedVersion) {
    const state = await readState(customerId);
    return { ok: true, data: { review, state: state.ok ? state.data : undefined } };
  }
  return { ok: true, data: { review } };
}

/** POST submit with the rep's signature (PNG data URL). Returns the refreshed state. */
export async function submitComplianceReview(
  customerId: number,
  expectedVersion: number | null,
  answers: ComplianceAnswers,
  signature: string,
): Promise<ComplianceResult<ComplianceState>> {
  if (!validId(customerId)) return { ok: false, status: null, error: "Missing customer." };
  if (!signature.startsWith("data:image/png;base64,")) {
    return { ok: false, status: null, error: "Sign the review before submitting." };
  }
  const res = await apiFetch(`${base(customerId)}/submit`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion, review: answersOf(answers), signature }),
  }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not submit the review.");
  const submitted = (await res.json().catch(() => null)) as ComplianceReview | null;

  revalidatePath(`/customers/${customerId}`);
  const state = await readState(customerId);
  if (state.ok) return state;
  // The submit landed; only the refresh failed. Fall back to what submit returned.
  return { ok: true, data: { current: submitted, history: [] } };
}

/** DELETE draft: restores the previous version as current (or clears it). Returns the new state (the API responds with the GET overview). */
export async function discardComplianceDraft(
  customerId: number,
  expectedVersion: number,
): Promise<ComplianceResult<ComplianceState>> {
  if (!validId(customerId)) return { ok: false, status: null, error: "Missing customer." };
  const res = await apiFetch(`${base(customerId)}/draft?expectedVersion=${expectedVersion}`, {
    method: "DELETE",
  }).catch(() => null);
  if (!res?.ok) return failure(res, "Could not discard the draft.");

  revalidatePath(`/customers/${customerId}`);
  return parseState(res);
}
