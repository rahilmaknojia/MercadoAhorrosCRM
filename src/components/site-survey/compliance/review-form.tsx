"use client";

import { SECTIONS, type ComplianceAnswers, type ReviewRound } from "@/lib/compliance";
import { ReviewHeader } from "./review-header";
import { ReviewSection } from "./review-section";

/** The whole review — header row and the five sections — editable or read-only. */
export function ReviewForm({
  answers,
  onChange,
  readOnly,
  suggestFor,
  sectionsOpen = true,
}: {
  answers: ComplianceAnswers;
  onChange?: (next: ComplianceAnswers) => void;
  readOnly: boolean;
  suggestFor?: (year?: number, quarter?: string) => { round: ReviewRound; submitted: number } | null;
  sectionsOpen?: boolean;
}) {
  return (
    <div className="space-y-4">
      <ReviewHeader
        answers={answers}
        onChange={onChange}
        readOnly={readOnly}
        suggestFor={suggestFor ?? (() => null)}
      />
      <div className="space-y-3">
        {SECTIONS.map((def) => (
          <ReviewSection
            key={def.key}
            def={def}
            answers={answers}
            onChange={onChange}
            readOnly={readOnly}
            defaultOpen={sectionsOpen}
          />
        ))}
      </div>
    </div>
  );
}
