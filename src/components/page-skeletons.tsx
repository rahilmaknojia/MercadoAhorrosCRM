import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Route-level loading placeholders, rendered by each section's loading.tsx the instant a
// navigation starts, while the server fetches the page. Each is shaped like the page it stands in
// for (so nothing jumps when the content arrives) and carries a visible "Loading …" label so it is
// obvious the page is on its way rather than broken.

/** Spinner + text that tells the user what is loading. Also the screen-reader announcement. */
export function LoadingLabel({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

/** Title + subtitle + action buttons row, as at the top of most pages. */
export function PageHeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>
    </div>
  );
}

/** A bordered table with a header row and `rows` body rows. */
export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="flex gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          {Array.from({ length: columns - 1 }, (_, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-56")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A grid of `count` cards (dashboard tiles, report cards). */
export function CardGridSkeleton({
  count = 6,
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  cardClassName = "h-28",
}: {
  count?: number;
  className?: string;
  cardClassName?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn("space-y-3 rounded-xl border bg-card p-5 shadow-xs", cardClassName)}>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** A card of labelled inputs, as on create/edit forms and builders. */
export function FormSkeleton({ fields = 8 }: { fields?: number }) {
  return (
    <div className="space-y-5 rounded-xl border bg-card p-6 shadow-xs">
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

/** Generic page: label, header, and a block of content. The fallback for any route. */
export function PageSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-6">
      <LoadingLabel label={label} />
      <PageHeaderSkeleton />
      <CardGridSkeleton count={3} />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
