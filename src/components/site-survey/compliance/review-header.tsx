"use client";

import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deriveQuarterYear,
  QUARTERS,
  quarterLabel,
  REVIEW_ROUNDS,
  roundLabel,
  type ComplianceAnswers,
  type Quarter,
  type ReviewRound,
  type YesNo,
} from "@/lib/compliance";
import { cn } from "@/lib/utils";
import { AnswerControl } from "./answer-control";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function fmtDay(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(y, m - 1, d));
}

/**
 * The review's header row: visit date, quarter/year (derived from the date until overridden),
 * the review round (suggested from what was already submitted that quarter) and the
 * warned-for-outsourcing answer.
 *
 * Derivation is stateless: when the date changes, quarter/year follow it only if they still hold
 * the values derived from the previous date (i.e. the rep has not overridden them). The round
 * follows the suggestion the same way.
 */
export function ReviewHeader({
  answers,
  onChange,
  readOnly,
  suggestFor,
}: {
  answers: ComplianceAnswers;
  onChange?: (next: ComplianceAnswers) => void;
  readOnly: boolean;
  /** The suggested round for a year+quarter, and how many were already submitted there. */
  suggestFor: (year?: number, quarter?: string) => { round: ReviewRound; submitted: number } | null;
}) {
  const suggestion = suggestFor(answers.year, answers.quarter);

  function withRound(prev: ComplianceAnswers, next: ComplianceAnswers): ComplianceAnswers {
    const before = suggestFor(prev.year, prev.quarter)?.round;
    const after = suggestFor(next.year, next.quarter)?.round;
    if (after && (!prev.review || prev.review === before)) return { ...next, review: after };
    return next;
  }

  function changeDate(date: string) {
    const was = deriveQuarterYear(answers.visit_date);
    const now = deriveQuarterYear(date);
    const next: ComplianceAnswers = { ...answers, visit_date: date || undefined };
    if (!answers.quarter || answers.quarter === was.quarter) next.quarter = now.quarter ?? answers.quarter;
    if (!answers.year || answers.year === was.year) next.year = now.year ?? answers.year;
    onChange?.(withRound(answers, next));
  }

  function changeQuarter(q: string) {
    onChange?.(withRound(answers, { ...answers, quarter: (q || undefined) as Quarter | undefined }));
  }

  function changeYear(raw: string) {
    const n = Number(raw);
    const year = raw.trim() && Number.isInteger(n) ? n : undefined;
    onChange?.(withRound(answers, { ...answers, year }));
  }

  if (readOnly) {
    return (
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReadField label="Visit date" value={fmtDay(answers.visit_date)} />
        <ReadField
          label="Quarter"
          value={[quarterLabel(answers.quarter), answers.year].filter(Boolean).join(" ") || "—"}
        />
        <ReadField label="Review" value={roundLabel(answers.review) || "—"} />
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">Warned for outsourcing</dt>
          <dd>
            <AnswerControl
              label="Warned for outsourcing"
              value={answers.warned_for_outsourcing}
              problem={answers.warned_for_outsourcing === "yes"}
              readOnly
            />
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr_auto]">
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <Label htmlFor="cr-visit-date">Visit date</Label>
        <Input
          id="cr-visit-date"
          type="date"
          className="h-9"
          value={answers.visit_date ?? ""}
          onChange={(e) => changeDate(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cr-quarter">Quarter</Label>
        <select
          id="cr-quarter"
          className={selectClass}
          value={answers.quarter ?? ""}
          onChange={(e) => changeQuarter(e.target.value)}
        >
          <option value="">—</option>
          {QUARTERS.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cr-year">Year</Label>
        <Input
          id="cr-year"
          type="number"
          inputMode="numeric"
          min={2000}
          max={2100}
          className="h-9"
          value={answers.year ?? ""}
          onChange={(e) => changeYear(e.target.value)}
        />
      </div>
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <Label htmlFor="cr-round">Review round</Label>
        <select
          id="cr-round"
          className={selectClass}
          value={answers.review ?? ""}
          onChange={(e) => onChange?.({ ...answers, review: (e.target.value || undefined) as ReviewRound | undefined })}
        >
          <option value="">—</option>
          {REVIEW_ROUNDS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {suggestion && (
          <p
            className={cn(
              "flex items-center gap-1 text-xs",
              answers.review === suggestion.round ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"
            )}
          >
            <Sparkles className="size-3 shrink-0" />
            {answers.review === suggestion.round ? "Suggested" : `Suggested: ${roundLabel(suggestion.round)}`}
            {" — "}
            {suggestion.submitted === 0 ? "none" : suggestion.submitted} submitted this quarter
          </p>
        )}
      </div>
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <span className="text-sm leading-none font-medium">Warned for outsourcing?</span>
        <div>
          <AnswerControl
            label="Warned for outsourcing"
            value={answers.warned_for_outsourcing}
            problem={answers.warned_for_outsourcing === "yes"}
            onChange={(v) => onChange?.({ ...answers, warned_for_outsourcing: v as YesNo | undefined })}
          />
        </div>
      </div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
