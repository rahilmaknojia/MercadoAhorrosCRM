import { FormSkeleton, LoadingLabel, PageHeaderSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <LoadingLabel label="Loading…" />
      <PageHeaderSkeleton actions={0} />
      <FormSkeleton fields={8} />
    </div>
  );
}
