import { CardGridSkeleton, LoadingLabel, PageHeaderSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading reports…" />
      <PageHeaderSkeleton actions={2} />
      <CardGridSkeleton count={6} />
    </div>
  );
}
