import { LoadingLabel, TableSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-4">
      <LoadingLabel label="Loading master data…" />
      <TableSkeleton rows={8} columns={4} />
    </div>
  );
}
