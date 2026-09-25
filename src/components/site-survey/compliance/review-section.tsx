"use client";

import { Check, ChevronDown, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import {
  getAnswer,
  isProblem,
  isVisible,
  sectionProgress,
  setAnswer,
  type ComplianceAnswers,
  type SectionDef,
} from "@/lib/compliance";
import { cn } from "@/lib/utils";
import { AnswerControl } from "./answer-control";

/** One collapsible review section: its questions, an answered x/y indicator and notes. */
export function ReviewSection({
  def,
  answers,
  onChange,
  readOnly,
  defaultOpen = true,
}: {
  def: SectionDef;
  answers: ComplianceAnswers;
  onChange?: (next: ComplianceAnswers) => void;
  readOnly: boolean;
  defaultOpen?: boolean;
}) {
  const { answered, total } = sectionProgress(def, answers);
  const complete = total > 0 && answered === total;
  const notes = getAnswer(answers, def.key, ["notes"]) ?? "";
  const problems = def.groups
    .flatMap((g) => g.questions)
    .filter((q) => isVisible(q, answers) && isProblem(q, answers, getAnswer(answers, def.key, q.path))).length;

  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-xl border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{def.title}</span>
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full transition-[width]", complete ? "bg-emerald-500" : "bg-brand-yellow")}
                style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
              />
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {complete ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
                  <Check className="size-3" /> All {total} answered
                </span>
              ) : (
                `Answered ${answered}/${total}`
              )}
            </span>
            {problems > 0 && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                {problems} flagged
              </span>
            )}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t px-4 pt-3 pb-4">
        {def.hint && (
          <p className="mb-3 flex items-start gap-2 rounded-lg bg-brand-yellow/15 px-3 py-2 text-xs text-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {def.hint}
          </p>
        )}

        <div className="space-y-4">
          {def.groups.map((group, gi) => (
            <div key={group.title ?? gi} className="space-y-1">
              {group.title && (
                <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.title}</h4>
              )}
              <ul className="divide-y">
                {group.questions
                  .filter((q) => isVisible(q, answers))
                  .map((q) => {
                    const value = getAnswer(answers, def.key, q.path);
                    const problem = isProblem(q, answers, value);
                    return (
                      <li
                        key={q.path.join(".")}
                        className={cn(
                          "-mx-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-md px-2 py-2",
                          problem && "bg-destructive/5"
                        )}
                      >
                        <span className={cn("min-w-0 flex-1 text-sm", problem && "font-medium text-destructive")}>
                          {q.label}
                        </span>
                        <AnswerControl
                          label={q.label}
                          value={value}
                          options={q.options}
                          problem={problem}
                          readOnly={readOnly}
                          onChange={(v) => onChange?.(setAnswer(answers, def.key, q.path, v))}
                        />
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}

          <div className="space-y-1">
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notes</h4>
            {readOnly ? (
              <p className={cn("text-sm whitespace-pre-wrap", !notes && "text-muted-foreground")}>{notes || "—"}</p>
            ) : (
              <Textarea
                value={notes}
                placeholder="Add notes for this section…"
                aria-label={`${def.title} notes`}
                onChange={(e) => onChange?.(setAnswer(answers, def.key, ["notes"], e.target.value))}
              />
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
