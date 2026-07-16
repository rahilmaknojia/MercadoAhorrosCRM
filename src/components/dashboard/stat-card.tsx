import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A single dashboard KPI tile. Presentational and server-renderable. */
export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  iconClassName,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  iconClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            iconClassName
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
