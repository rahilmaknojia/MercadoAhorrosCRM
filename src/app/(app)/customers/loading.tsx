import { LoadingLabel, PageHeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading customers…" />
      <PageHeaderSkeleton actions={2} />
      <div className="flex gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-24" />
      </div>
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
