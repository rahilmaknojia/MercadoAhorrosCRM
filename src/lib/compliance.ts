/**
 * Compliance Review — types, the question catalogue and the pure rules the CRM needs
 * (spec §2). Client-safe; no server imports.
 *
 * Shape notes (the API normalises on every write, so these mirror its rules):
 *  - answers are the strings "yes" / "no"; unanswered = key absent
 *  - `version`, `status`, `issues`, `rep_signature`, `*_by`, `*_on`, `source`, `legacy` are
 *    server-owned and never sent back
 *  - `site_visit.inquired_dsd_status` is only kept when `s2u_or_dsd` is "s2u"
 */

export type YesNo = "yes" | "no";
export type Quarter = "q1" | "q2" | "q3" | "q4";
export type ReviewRound = "first" | "second" | "final";
export type ReviewStatus = "draft" | "submitted";

/** A section's answers (nested groups of yes/no plus `notes`). */
export type SectionData = { [key: string]: string | SectionData | undefined };

export type SectionKey = "display_space" | "pos" | "cold_equipment" | "cold_vault" | "site_visit";

/** The client-editable part of a review — exactly what PUT draft / POST submit accept. */
export type ComplianceAnswers = {
  year?: number;
  quarter?: Quarter;
  review?: ReviewRound;
  visit_date?: string;
  warned_for_outsourcing?: YesNo;
} & Partial<Record<SectionKey, SectionData>>;

export type IssueCode =
  | "unauthorized_product"
  | "unauthorized_product_not_removed"
  | "person_in_charge_not_notified"
  | "warned_for_outsourcing"
  | "pos_missing_on_departure"
  | "program_not_understood";

/** A full review as the API returns it (raw snake_case, current or archived). */
export type ComplianceReview = ComplianceAnswers & {
  version: number;
  status: ReviewStatus;
  issues?: Partial<Record<string, true>>;
  rep_signature?: { key: string; signed_by?: string; signed_on?: string };
  created_by?: string;
  created_on?: string;
  modified_by?: string;
  modified_on?: string;
  submitted_by?: string;
  submitted_on?: string;
  source?: string;
  legacy?: { id?: number; version?: number; modified_by?: string };
};

/** `history` entries from GET (camelCase), newest first. */
export type ComplianceHistorySummary = {
  version: number;
  status: ReviewStatus;
  year?: number | null;
  quarter?: Quarter | null;
  review?: ReviewRound | null;
  visitDate?: string | null;
  submittedBy?: string | null;
  submittedOn?: string | null;
  issues: string[];
  source?: string | null;
};

export type ComplianceState = {
  current: ComplianceReview | null;
  history: ComplianceHistorySummary[];
};

// --- Labels ------------------------------------------------------------------------------------

export const QUARTERS: { value: Quarter; label: string }[] = [
  { value: "q1", label: "Q1" },
  { value: "q2", label: "Q2" },
  { value: "q3", label: "Q3" },
  { value: "q4", label: "Q4" },
];

export const REVIEW_ROUNDS: { value: ReviewRound; label: string; short: string }[] = [
  { value: "first", label: "1st review", short: "1st" },
  { value: "second", label: "2nd review", short: "2nd" },
  { value: "final", label: "Final review", short: "Final" },
];

export const ISSUE_LABELS: Record<IssueCode, string> = {
  unauthorized_product: "Unauthorized product in cold equipment",
  unauthorized_product_not_removed: "Unauthorized product not removed",
  person_in_charge_not_notified: "Person in charge not notified",
  warned_for_outsourcing: "Warned for outsourcing",
  pos_missing_on_departure: "POS missing on departure",
  program_not_understood: "Program not fully understood",
};

export const issueLabel = (code: string) =>
  ISSUE_LABELS[code as IssueCode] ?? code.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const quarterLabel = (q?: string | null) => (q ? q.toUpperCase() : "");
export const roundLabel = (r?: string | null) => REVIEW_ROUNDS.find((x) => x.value === r)?.label ?? "";

/** "Sep 25, 2026" (optionally with time). A bare yyyy-MM-dd is a calendar date, parsed as local. */
export function formatReviewDate(iso?: string | null, withTime = false): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(
    "en-US",
    withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
  ).format(d);
}

// --- Question catalogue ------------------------------------------------------------------------

export type QuestionOption = { value: string; label: string };

export const YES_NO: QuestionOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export type QuestionDef = {
  /** Path within the section, e.g. ["gondola", "pepsi"]. */
  path: string[];
  label: string;
  /** Standalone label for diffs / summaries, e.g. "Pepsi gondola space". */
  diffLabel: string;
  options?: QuestionOption[];
  /** The answer that signals a problem (spec §2.3), highlighted in the destructive colour. */
  problem?: YesNo;
  /** When the problem answer only counts under a condition. */
  problemIf?: (a: ComplianceAnswers) => boolean;
  /** Hidden (and not counted) unless this holds. */
  visibleIf?: (a: ComplianceAnswers) => boolean;
};

export type QuestionGroup = { title?: string; questions: QuestionDef[] };

export type SectionDef = {
  key: SectionKey;
  title: string;
  hint?: string;
  groups: QuestionGroup[];
};

const brands = (group: string, groupLabel: string, list: [string, string][]): QuestionDef[] =>
  list.map(([key, label]) => ({ path: [group, key], label, diffLabel: `${label} ${groupLabel}` }));

const unauthorizedFound = (a: ComplianceAnswers) => getAnswer(a, "cold_equipment", ["unauthorized_product_found"]) === "yes";

export const SECTIONS: SectionDef[] = [
  {
    key: "display_space",
    title: "Display & space integrity",
    groups: [
      {
        title: "Gondola space",
        questions: brands("gondola", "gondola space", [
          ["coke", "Coke"],
          ["pepsi", "Pepsi"],
          ["kdp", "KDP"],
          ["frito_lay", "Frito-Lay"],
          ["bimbo_takis", "Bimbo / Takis"],
        ]),
      },
      {
        title: "2 liter",
        questions: brands("two_liter", "2 liter space", [
          ["coke", "Coke"],
          ["pepsi", "Pepsi"],
          ["kdp", "KDP"],
        ]),
      },
      {
        title: "12 pack",
        questions: brands("twelve_pack", "12 pack space", [
          ["coke", "Coke"],
          ["pepsi", "Pepsi"],
          ["kdp", "KDP"],
        ]),
      },
    ],
  },
  {
    key: "pos",
    title: "POS integrity",
    hint: "If not displayed, must be displayed before departing.",
    groups: (["upon_arrival", "upon_departure"] as const).map((group) => {
      const when = group === "upon_arrival" ? "on arrival" : "on departure";
      return {
        title: group === "upon_arrival" ? "Upon arrival" : "Upon departure",
        questions: [
          ["posters", "Posters"],
          ["clings", "Clings"],
          ["shelf_talkers", "Shelf talkers"],
        ].map(([key, label]) => ({
          path: [group, key],
          label,
          diffLabel: `${label} ${when}`,
          problem: group === "upon_departure" ? ("no" as const) : undefined,
        })),
      };
    }),
  },
  {
    key: "cold_equipment",
    title: "Cold equipment integrity",
    groups: [
      {
        questions: [
          {
            path: ["unauthorized_product_found"],
            label: "Unauthorized product in cold equipment?",
            diffLabel: "Unauthorized product found",
            problem: "yes",
          },
          {
            path: ["unauthorized_product_removed"],
            label: "Was the unauthorized product removed?",
            diffLabel: "Unauthorized product removed",
            problem: "no",
            problemIf: unauthorizedFound,
          },
          {
            path: ["person_in_charge_notified"],
            label: "Was the person in charge notified and educated?",
            diffLabel: "Person in charge notified",
            problem: "no",
            problemIf: unauthorizedFound,
          },
        ],
      },
    ],
  },
  {
    key: "cold_vault",
    title: "Cold vault integrity",
    groups: [
      {
        title: "20 oz",
        questions: [
          ["coke", "Coke"],
          ["pepsi", "Pepsi"],
          ["dr_pepper", "Dr Pepper"],
        ].map(([key, label]) => ({ path: [key], label, diffLabel: `${label} 20 oz in cold vault` })),
      },
      {
        title: "Other",
        questions: [
          ["monster", "Monster"],
          ["red_bull", "Red Bull"],
          ["gatorade", "Gatorade"],
          ["powerade", "Powerade"],
          ["energy", "Energy"],
          ["hydration", "Hydration"],
          ["tea", "Tea"],
          ["juice", "Juice"],
        ].map(([key, label]) => ({ path: [key], label, diffLabel: `${label} in cold vault` })),
      },
    ],
  },
  {
    key: "site_visit",
    title: "Site visit & program integrity",
    groups: [
      {
        questions: [
          {
            path: ["understands_program"],
            label: "Does owner / management understand the Mercado Ahorros program?",
            diffLabel: "Understands the program",
            problem: "no",
          },
          {
            path: ["understands_rebate_dependency"],
            label: "Understand rebate checks depend on program participation?",
            diffLabel: "Understands rebate dependency",
            problem: "no",
          },
          {
            path: ["understands_outsourcing_prohibited"],
            label: "Understand outsourcing product by participating vendors is not permitted?",
            diffLabel: "Understands outsourcing is prohibited",
            problem: "no",
          },
          { path: ["frito_lay"], label: "Frito-Lay", diffLabel: "Frito-Lay" },
          {
            path: ["s2u_or_dsd"],
            label: "S2U or DSD?",
            diffLabel: "S2U or DSD",
            options: [
              { value: "s2u", label: "S2U" },
              { value: "dsd", label: "DSD" },
            ],
          },
          {
            path: ["inquired_dsd_status"],
            label: "If S2U, did you inquire DSD status?",
            diffLabel: "Inquired DSD status",
            visibleIf: (a) => getAnswer(a, "site_visit", ["s2u_or_dsd"]) === "s2u",
          },
        ],
      },
    ],
  },
];

// --- Access helpers ----------------------------------------------------------------------------

export function getAnswer(a: ComplianceAnswers, section: SectionKey, path: string[]): string | undefined {
  let node: SectionData | string | undefined = a[section];
  for (const key of path) {
    if (!node || typeof node !== "object") return undefined;
    node = node[key];
  }
  return typeof node === "string" ? node : undefined;
}

/** Immutable set; `undefined` removes the key and prunes groups left empty. */
export function setAnswer(
  a: ComplianceAnswers,
  section: SectionKey,
  path: string[],
  value: string | undefined,
): ComplianceAnswers {
  const write = (node: SectionData | undefined, depth: number): SectionData | undefined => {
    const next: SectionData = { ...(node ?? {}) };
    const key = path[depth];
    if (depth === path.length - 1) {
      if (value === undefined || value === "") delete next[key];
      else next[key] = value;
    } else {
      const child = write(typeof next[key] === "object" ? (next[key] as SectionData) : undefined, depth + 1);
      if (child) next[key] = child;
      else delete next[key];
    }
    return Object.keys(next).length ? next : undefined;
  };
  const updated = write(a[section], 0);
  const out: ComplianceAnswers = { ...a };
  if (updated) out[section] = updated;
  else delete out[section];
  return out;
}

export const isVisible = (q: QuestionDef, a: ComplianceAnswers) => !q.visibleIf || q.visibleIf(a);

export function isProblem(q: QuestionDef, a: ComplianceAnswers, value: string | undefined): boolean {
  return !!q.problem && value === q.problem && (!q.problemIf || q.problemIf(a));
}

/** Answered / total for one section (hidden questions don't count). */
export function sectionProgress(def: SectionDef, a: ComplianceAnswers) {
  let answered = 0;
  let total = 0;
  for (const g of def.groups) {
    for (const q of g.questions) {
      if (!isVisible(q, a)) continue;
      total += 1;
      if (getAnswer(a, def.key, q.path) !== undefined) answered += 1;
    }
  }
  return { answered, total };
}

export function overallProgress(a: ComplianceAnswers) {
  return SECTIONS.reduce(
    (acc, def) => {
      const p = sectionProgress(def, a);
      return { answered: acc.answered + p.answered, total: acc.total + p.total };
    },
    { answered: 0, total: 0 },
  );
}

// --- Rules -------------------------------------------------------------------------------------

/** Client mirror of the server's `issues` (spec §2.3), for live highlighting while editing. */
export function computeIssues(a: ComplianceAnswers): IssueCode[] {
  const issues: IssueCode[] = [];
  const found = getAnswer(a, "cold_equipment", ["unauthorized_product_found"]) === "yes";
  if (found) issues.push("unauthorized_product");
  if (found && getAnswer(a, "cold_equipment", ["unauthorized_product_removed"]) !== "yes") {
    issues.push("unauthorized_product_not_removed");
  }
  if (found && getAnswer(a, "cold_equipment", ["person_in_charge_notified"]) !== "yes") {
    issues.push("person_in_charge_not_notified");
  }
  if (a.warned_for_outsourcing === "yes") issues.push("warned_for_outsourcing");
  if (["posters", "clings", "shelf_talkers"].some((k) => getAnswer(a, "pos", ["upon_departure", k]) === "no")) {
    issues.push("pos_missing_on_departure");
  }
  if (
    ["understands_program", "understands_rebate_dependency", "understands_outsourcing_prohibited"].some(
      (k) => getAnswer(a, "site_visit", [k]) === "no",
    )
  ) {
    issues.push("program_not_understood");
  }
  return issues;
}

/** The fields POST submit requires (spec §2.5), as labels; empty when complete. */
export function missingRequired(a: ComplianceAnswers): string[] {
  const missing: string[] = [];
  if (!a.visit_date) missing.push("Visit date");
  if (!a.quarter) missing.push("Quarter");
  if (!a.year) missing.push("Year");
  if (!a.review) missing.push("Review round");
  return missing;
}

/** Submitted reviews already in the same year+quarter: 0 → first, 1 → second, ≥2 → final. */
export function suggestRound(submittedInQuarter: number): ReviewRound {
  return submittedInQuarter <= 0 ? "first" : submittedInQuarter === 1 ? "second" : "final";
}

export function countSubmittedInQuarter(
  reviews: { status: string; year?: number | null; quarter?: string | null; version: number }[],
  year: number | undefined,
  quarter: string | undefined,
  excludeVersion?: number,
): number {
  if (!year || !quarter) return 0;
  return reviews.filter(
    (r) => r.status === "submitted" && r.year === year && r.quarter === quarter && r.version !== excludeVersion,
  ).length;
}

/** `yyyy-MM-dd` in the viewer's local time zone. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function deriveQuarterYear(date?: string): { quarter?: Quarter; year?: number } {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date ?? "");
  if (!m) return {};
  const month = Number(m[2]);
  if (month < 1 || month > 12) return {};
  return { year: Number(m[1]), quarter: `q${Math.ceil(month / 3)}` as Quarter };
}

/**
 * Picks only the client-editable keys from a (possibly full, server-returned) review, so
 * server-owned fields are never sent back. The server re-normalises anyway.
 */
export function answersOf(review: Partial<ComplianceReview> | null | undefined): ComplianceAnswers {
  if (!review) return {};
  const out: ComplianceAnswers = {};
  if (typeof review.year === "number") out.year = review.year;
  if (review.quarter) out.quarter = review.quarter;
  if (review.review) out.review = review.review;
  if (review.visit_date) out.visit_date = review.visit_date;
  if (review.warned_for_outsourcing) out.warned_for_outsourcing = review.warned_for_outsourcing;
  for (const def of SECTIONS) {
    const data = review[def.key];
    if (data && typeof data === "object") out[def.key] = structuredClone(data);
  }
  return out;
}

/** A blank review for today, with the round suggested from what was already submitted. */
export function blankAnswers(submitted: ComplianceHistorySummary[]): ComplianceAnswers {
  const visit_date = todayIso();
  const { year, quarter } = deriveQuarterYear(visit_date);
  return {
    visit_date,
    year,
    quarter,
    review: suggestRound(countSubmittedInQuarter(submitted, year, quarter)),
  };
}

/** Converts the current review into a summary, so the timeline can list it with the history. */
export function summarize(r: ComplianceReview): ComplianceHistorySummary {
  return {
    version: r.version,
    status: r.status,
    year: r.year ?? null,
    quarter: r.quarter ?? null,
    review: r.review ?? null,
    visitDate: r.visit_date ?? null,
    submittedBy: r.submitted_by ?? null,
    submittedOn: r.submitted_on ?? null,
    issues: Object.keys(r.issues ?? {}),
    source: r.source ?? null,
  };
}

// --- Diff --------------------------------------------------------------------------------------

export type DiffLine = { label: string; from: string; to: string };

const show = (v: unknown, options?: QuestionOption[]) => {
  if (v === undefined || v === null || v === "") return "—";
  const s = String(v);
  return (options ?? YES_NO).find((o) => o.value === s)?.label ?? s;
};

/** Human-readable differences between two reviews ("Pepsi gondola space: No → Yes"). */
export function diffReviews(prev: ComplianceAnswers, next: ComplianceAnswers): DiffLine[] {
  const lines: DiffLine[] = [];
  const push = (label: string, a: string, b: string) => {
    if (a !== b) lines.push({ label, from: a, to: b });
  };
  push("Visit date", show(prev.visit_date), show(next.visit_date));
  push("Quarter", show(quarterLabel(prev.quarter)), show(quarterLabel(next.quarter)));
  push("Year", show(prev.year), show(next.year));
  push("Review round", show(roundLabel(prev.review)), show(roundLabel(next.review)));
  push("Warned for outsourcing", show(prev.warned_for_outsourcing), show(next.warned_for_outsourcing));
  for (const def of SECTIONS) {
    for (const g of def.groups) {
      for (const q of g.questions) {
        push(
          q.diffLabel,
          show(getAnswer(prev, def.key, q.path), q.options),
          show(getAnswer(next, def.key, q.path), q.options),
        );
      }
    }
    const a = getAnswer(prev, def.key, ["notes"]) ?? "";
    const b = getAnswer(next, def.key, ["notes"]) ?? "";
    if (a.trim() !== b.trim()) {
      lines.push({ label: `${def.title} notes`, from: a.trim() || "—", to: b.trim() || "—" });
    }
  }
  return lines;
}
