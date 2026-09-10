import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ReportBuilder } from "@/components/report-builder";

export default function ReportQueryPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Query</h1>
          <p className="text-sm text-muted-foreground">
            Build a one-off query, run it, and export the result. Nothing is saved — use{" "}
            <Link href="/reports/new" className="underline underline-offset-4">
              New report
            </Link>{" "}
            if you want to keep it.
          </p>
        </div>
        <Link href="/reports" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ChevronLeft /> Reports
        </Link>
      </div>

      <ReportBuilder mode="query" />
    </div>
  );
}
