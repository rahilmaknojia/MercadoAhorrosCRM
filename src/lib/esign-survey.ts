/**
 * Site Survey → eSignature helpers shared by the template manager and the send dialogs.
 * Client-safe; no server imports. The field catalog itself comes from the API
 * (GET /api/esignature/survey-fields) — nothing here duplicates it.
 */
import { SECTIONS } from "@/lib/compliance";
import type {
  ComplianceReviewRef,
  EsignatureMergeTokenMapping,
  EsignatureSourceSnapshot,
  EsignatureTemplateMapping,
  SurveyFieldFormat,
} from "@/lib/types";

export const COMPLIANCE_PREFIX = "compliance.";

export const isComplianceField = (key?: string | null) => !!key && key.startsWith(COMPLIANCE_PREFIX);

/** Does this token read the compliance review (so the send dialog offers the version pin)? */
export const isComplianceToken = (t: EsignatureMergeTokenMapping) =>
  t.source === "siteSurvey" && isComplianceField(t.field);

export function parseTemplateMapping(json: string): EsignatureTemplateMapping {
  try {
    const m = JSON.parse(json) as EsignatureTemplateMapping;
    return { roles: m.roles ?? [], mergeTokens: m.mergeTokens ?? [] };
  } catch {
    return { roles: [], mergeTokens: [] };
  }
}

/** Suggested merge-token name for a catalog key ("coke.rack_10cs" → "coke_rack_10cs"). */
export const tokenNameForField = (key: string) => key.replace(/\./g, "_");

/** Compliance section title for a key like "compliance.display_space.gondola.coke", else null. */
export function complianceSectionTitle(key: string): string | null {
  if (!isComplianceField(key)) return null;
  const section = key.split(".")[1];
  return SECTIONS.find((s) => s.key === section)?.title ?? null;
}

/** Inline example for a format: `"Yes" / "No"`, `"X" / blank`. */
export function formatExample(f: Pick<SurveyFieldFormat, "yes" | "no">): string {
  const show = (v: string) => (v ? `"${v}"` : "blank");
  return `${show(f.yes)} / ${show(f.no)}`;
}

/** MM/dd/yyyy. A bare yyyy-MM-dd is a calendar date (no time-zone shift). */
export function mmddyyyy(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m && iso.length === 10) return `${m[2]}/${m[3]}/${m[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

const ROUND_LABELS: Record<string, string> = {
  first: "1st Review",
  second: "2nd Review",
  final: "Final Review",
};

/** "Q3 2026" — tolerant of "q3" or an already-formatted "Q3". */
export function quarterYear(ref: Pick<ComplianceReviewRef, "quarter" | "year">): string {
  return [ref.quarter ? ref.quarter.toUpperCase() : "", ref.year ?? ""].filter(Boolean).join(" ");
}

/** "1st Review" — tolerant of the raw enum or an already-formatted label. */
export const reviewRoundLabel = (r?: string | null) => (r ? ROUND_LABELS[r.toLowerCase()] ?? r : "");

/** "v3 · Q3 2026 · 1st Review · submitted 09/25/2026". */
export function reviewRefLabel(ref: ComplianceReviewRef, status: "submitted" | "draft" = "submitted"): string {
  const parts = [`v${ref.version}`, quarterYear(ref), reviewRoundLabel(ref.review)];
  if (status === "draft") parts.push("draft");
  else if (ref.submittedOn) parts.push(`submitted ${mmddyyyy(ref.submittedOn)}`);
  return parts.filter(Boolean).join(" · ");
}

/** Documents-list chip text: "Compliance review v3 · Q3 2026", or null when nothing was recorded. */
export function snapshotChipLabel(snapshot?: EsignatureSourceSnapshot | string | null): string | null {
  let snap = snapshot;
  if (typeof snap === "string") {
    try {
      snap = JSON.parse(snap) as EsignatureSourceSnapshot;
    } catch {
      return null;
    }
  }
  const ref = snap?.complianceReview;
  if (!ref || typeof ref.version !== "number") return null;
  const qy = quarterYear(ref);
  return `Compliance review v${ref.version}${qy ? ` · ${qy}` : ""}`;
}
