import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/authz";
import { buildReportCsv, csvHeaders } from "@/lib/server/report-csv";
import type { ReportDefinition } from "@/lib/types";

/**
 * Export an **unsaved** report definition.
 *
 * The saved-report sibling at `[id]/export` loads its definition from a preset; this one takes the
 * definition in the request body, so a query can be run and exported without first being saved.
 * Both share the renderer in `@/lib/server/report-csv`.
 *
 * POST rather than GET because a definition with several filters and a column list does not fit
 * comfortably in a URL, and a body keeps it out of access logs. The client turns the response into
 * a download via a blob URL.
 */
export async function POST(req: NextRequest) {
  const cookie = req.headers.get("cookie");

  const jwt = await getJwt(cookie);
  if (!jwt) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await hasPermission("reports:export", cookie))) {
    return NextResponse.json({ error: "Not authorized to export reports." }, { status: 403 });
  }

  let definition: ReportDefinition;
  try {
    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("not an object");
    }

    definition = body as ReportDefinition;
  } catch {
    return NextResponse.json({ error: "Expected a report definition as the request body." }, { status: 400 });
  }

  const result = await buildReportCsv(definition, { Authorization: `Bearer ${jwt}` });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(result.csv, {
    status: 200,
    headers: csvHeaders(`query-${stamp}`, result.truncated),
  });
}
