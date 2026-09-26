import { CardGridSkeleton, LoadingLabel } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <div className="space-y-4">
      <LoadingLabel label="Loading eSignature templates…" />
      <CardGridSkeleton count={4} className="space-y-3" cardClassName="h-24" />
    </div>
  );
}
