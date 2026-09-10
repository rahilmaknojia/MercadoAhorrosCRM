import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/authz";
import { parseDefinition } from "@/lib/report";
import { buildReportCsv, csvHeaders } from "@/lib/server/report-csv";
import type { ReportPreset } from "@/lib/types";

const API = process.env.API_BASE_URL!;

/** Export a saved report. The definition comes from the preset; the CSV is built by the shared
 *  renderer in `@/lib/server/report-csv`, which the ad-hoc export route uses too. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookie = req.headers.get("cookie");

  const jwt = await getJwt(cookie);
  if (!jwt) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Checked here rather than relying on the API: for the customers source this route calls
  // /api/customers (customers:read) and the aggregate endpoints (reports:read), neither of which
  // requires reports:export. Only the customer-vendor branch hits an endpoint that enforces it.
  if (!(await hasPermission("reports:export", cookie))) {
    return NextResponse.json({ error: "Not authorized to export reports." }, { status: 403 });
  }

  const auth = { Authorization: `Bearer ${jwt}` };

  const presetRes = await fetch(`${API}/api/reportpresets/${id}`, {
    headers: auth,
    cache: "no-store",
  }).catch(() => null);

  if (!presetRes?.ok) {
    return NextResponse.json({ error: "Report not found" }, { status: presetRes?.status ?? 404 });
  }

  const preset = (await presetRes.json()) as ReportPreset;
  const result = await buildReportCsv(parseDefinition(preset.queryParameters), auth);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(result.csv, {
    status: 200,
    headers: csvHeaders(preset.name, result.truncated),
  });
}
