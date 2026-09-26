import { LoadingLabel, PageHeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Running a report can take a while on large data sets — say so.
export default function Loading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Running report…" />
      <PageHeaderSkeleton actions={2} />
      <Skeleton className="h-72 w-full rounded-xl" />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
