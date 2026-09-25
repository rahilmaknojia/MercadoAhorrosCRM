import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { issueLabel } from "@/lib/compliance";
import { cn } from "@/lib/utils";

/** The issues a review flags, as destructive chips; "No issues" when clean (if `showNone`). */
export function IssueChips({
  issues,
  showNone = false,
  size = "default",
  className,
}: {
  issues: string[];
  showNone?: boolean;
  size?: "default" | "sm";
  className?: string;
}) {
  if (issues.length === 0) {
    return showNone ? (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400",
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
          className
        )}
      >
        <CheckCircle2 className="size-3.5" /> No issues
      </span>
    ) : null;
  }
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {issues.map((code) => (
        <span
          key={code}
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-destructive/10 font-medium text-destructive",
            size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
          )}
        >
          <AlertTriangle className="size-3" />
          {issueLabel(code)}
        </span>
      ))}
    </div>
  );
}
