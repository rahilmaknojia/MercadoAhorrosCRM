/**
 * Site survey scores report (`GET /api/reports/survey-scores`): submitted cooler surveys and
 * compliance reviews per zone manager per year.
 *
 * - Completeness = fields filled ÷ the survey's scoreable fields.
 * - Activity = fields the visit added, updated or cleared vs the member's previous version ÷ the same total.
 */

export type SurveyKind = "coolers" | "compliance";
export type SurveyFilter = "all" | SurveyKind;
export type ScoreGroupBy = "zoneManager" | "submittedBy";

export type SurveyScoreRow = {
  customerId: number;
  memberId: string | null;
  businessName: string | null;
  zoneManager: string | null;
  submittedBy: string | null;
  submittedOn: string;
  survey: SurveyKind;
  version: number;
  total: number;
  filled: number;
  changed: number;
  completeness: number;
  activity: number;
};

export type SurveyScoreGroup = {
  key: string;
  surveys: number;
  members: number;
  coolerSurveys: number;
  complianceSurveys: number;
  /** Submitted with nothing added, changed or cleared — possibly re-submitted without checking. */
  unchanged: number;
  avgCompleteness: number;
  avgActivity: number;
};

export type SurveyScoreReport = {
  year: number;
  groupBy: ScoreGroupBy;
  survey: SurveyFilter;
  years: number[];
  totals: SurveyScoreGroup;
  groups: SurveyScoreGroup[];
  surveys: SurveyScoreRow[];
};

export const SURVEY_LABELS: Record<SurveyKind, string> = {
  coolers: "Coolers & Cold Vaults",
  compliance: "Compliance Review",
};

export const GROUP_BY_LABELS: Record<ScoreGroupBy, string> = {
  zoneManager: "Zone manager",
  submittedBy: "Submitted by",
};

/** Report rows as CSV (one line per survey). */
export function toCsv(report: SurveyScoreReport): string {
  const header = [
    "Member ID",
    "Business name",
    "Zone manager",
    "Submitted by",
    "Submitted on",
    "Survey",
    "Version",
    "Fields filled",
    "Fields added/changed",
    "Total fields",
    "Completeness %",
    "Activity %",
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = report.surveys.map((r) =>
    [
      r.memberId,
      r.businessName,
      r.zoneManager,
      r.submittedBy,
      r.submittedOn.slice(0, 10),
      SURVEY_LABELS[r.survey],
      r.version,
      r.filled,
      r.changed,
      r.total,
      r.completeness,
      r.activity,
    ]
      .map(esc)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
