import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import { parseDefinition } from "@/lib/report";
import type { ReportPreset } from "@/lib/types";
import { ReportBuilder } from "@/components/report-builder";

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let res: Response;
  try {
    res = await apiFetch(`/api/reportpresets/${id}`);
  } catch {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load report.
      </div>
    );
  }
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Failed to load report ({res.status}).
      </div>
    );
  }
  const preset = (await res.json()) as ReportPreset;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/reports/${preset.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to report
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Edit report</h1>
      </div>
      <ReportBuilder
        initial={{
          id: preset.id,
          name: preset.name,
          description: preset.description,
          definition: parseDefinition(preset.queryParameters),
        }}
      />
    </div>
  );
}
