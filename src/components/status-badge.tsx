import { cn } from "@/lib/utils";

// Functional status colors (not brand): green = active, amber = pending, muted = inactive.
// Anything unrecognized falls back to the neutral style.
const STYLES: Record<string, { dot: string; wrap: string }> = {
  active: { dot: "bg-emerald-500", wrap: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pending: { dot: "bg-amber-500", wrap: "border-amber-200 bg-amber-50 text-amber-700" },
  inactive: { dot: "bg-zinc-400", wrap: "border-zinc-200 bg-zinc-50 text-zinc-600" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STYLES[status.toLowerCase()] ?? STYLES.inactive;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.wrap,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {status}
    </span>
  );
}
