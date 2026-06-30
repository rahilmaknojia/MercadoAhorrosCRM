import Link from "next/link";
import { ReportBuilder } from "@/components/report-builder";

export default function NewReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports" className="text-sm text-muted-foreground hover:underline">
          ← Back to reports
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New report</h1>
        <p className="text-sm text-muted-foreground">
          Pick a visualization, add filters, then run a preview and save.
        </p>
      </div>
      <ReportBuilder />
    </div>
  );
}
