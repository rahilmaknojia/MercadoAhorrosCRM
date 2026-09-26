import { FormSkeleton, LoadingLabel } from "@/components/page-skeletons";

// Renders inside the settings layout, so the Settings title and side nav stay in place.
export default function Loading() {
  return (
    <div className="space-y-4">
      <LoadingLabel label="Loading settings…" />
      <FormSkeleton fields={6} />
    </div>
  );
}
