import { Check, CircleMinus, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Functional status colors (not brand): green = active, amber = pending, muted = inactive.
// Anything unrecognized falls back to the neutral style.
const STYLES: Record<string, { icon: LucideIcon; wrap: string }> = {
  active: { icon: Check, wrap: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pending: { icon: Clock, wrap: "border-amber-200 bg-amber-50 text-amber-700" },
  inactive: { icon: CircleMinus, wrap: "border-zinc-200 bg-zinc-50 text-zinc-600" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STYLES[status.toLowerCase()] ?? STYLES.inactive;
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.wrap,
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {status}
    </span>
  );
}
