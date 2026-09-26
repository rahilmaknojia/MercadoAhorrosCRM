import { LoadingLabel } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the member page: identity header, tab strip, then the Contact / Store cards.
export default function Loading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading member…" />
      <div className="flex flex-wrap items-center gap-4 border-b pb-5">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-80 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex gap-6 border-b pb-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="space-y-4 rounded-xl border bg-card p-6 shadow-xs">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 5 }, (_, r) => (
              <div key={r} className="flex gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
