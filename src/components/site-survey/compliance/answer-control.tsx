"use client";

import { AlertTriangle } from "lucide-react";
import { YES_NO, type QuestionOption } from "@/lib/compliance";
import { cn } from "@/lib/utils";

/**
 * A Yes / No (or other two-way) segmented control with an explicit unanswered state: nothing is
 * pressed until the rep picks, and clicking the pressed option again clears it back to
 * unanswered. `problem` is the answer that signals an issue; when it is the one chosen, the
 * control turns destructive.
 */
export function AnswerControl({
  label,
  value,
  onChange,
  options = YES_NO,
  problem = false,
  readOnly = false,
  disabled = false,
}: {
  label: string;
  value: string | undefined;
  onChange?: (value: string | undefined) => void;
  options?: QuestionOption[];
  problem?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  if (readOnly) {
    const chosen = options.find((o) => o.value === value);
    return (
      <span
        className={cn(
          "inline-flex h-7 min-w-12 items-center justify-center gap-1 rounded-md px-2.5 text-sm font-medium",
          !chosen && "text-muted-foreground",
          chosen && !problem && "bg-muted",
          chosen && problem && "bg-destructive/10 text-destructive"
        )}
      >
        {problem && <AlertTriangle className="size-3.5" />}
        {chosen?.label ?? "—"}
      </span>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 rounded-lg border p-0.5 transition-colors",
        value === undefined ? "border-dashed border-muted-foreground/40" : "border-border bg-muted/40",
        problem && "border-destructive/50"
      )}
    >
      {options.map((o) => {
        const pressed = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            title={pressed ? "Click again to clear" : undefined}
            onClick={() => onChange?.(pressed ? undefined : o.value)}
            className={cn(
              "inline-flex h-8 min-w-14 items-center justify-center gap-1 rounded-md px-3 text-sm font-medium transition-all outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              !pressed && "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              pressed && !problem && "bg-foreground text-background shadow-sm",
              pressed && problem && "bg-destructive text-white shadow-sm dark:text-background"
            )}
          >
            {pressed && problem && <AlertTriangle className="size-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
