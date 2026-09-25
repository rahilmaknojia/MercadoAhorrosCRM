import { CheckCircle2, PencilLine } from "lucide-react";
import type { ReviewStatus } from "@/lib/compliance";
import { cn } from "@/lib/utils";

/** "Draft" (yellow accent) or "Submitted vN" (green). */
export function StatusPill({ status, version, className }: { status: ReviewStatus; version: number; className?: string }) {
  return status === "draft" ? (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-brand-yellow px-2 py-0.5 text-xs font-medium text-brand-yellow-foreground",
        className
      )}
    >
      <PencilLine className="size-3" /> Draft v{version}
    </span>
  ) : (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400",
        className
      )}
    >
      <CheckCircle2 className="size-3" /> Submitted v{version}
    </span>
  );
}
