import { LoadingLabel, PageHeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading approvals…" />
      <PageHeaderSkeleton actions={0} />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
