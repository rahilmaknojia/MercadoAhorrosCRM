import { PageSkeleton } from "@/components/page-skeletons";

// Fallback for any page in the app shell that has no more specific loading.tsx.
export default function Loading() {
  return <PageSkeleton />;
}
