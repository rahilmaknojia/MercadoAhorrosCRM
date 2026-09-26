import { FormSkeleton, LoadingLabel } from "@/components/page-skeletons";

// Overrides settings/users/loading.tsx (a table) with the territory form's shape.
export default function Loading() {
  return (
    <div className="space-y-4">
      <LoadingLabel label="Loading territory…" />
      <FormSkeleton fields={4} />
    </div>
  );
}
