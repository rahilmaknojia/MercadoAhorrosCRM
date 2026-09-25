import { NextRequest, NextResponse } from "next/server";
import { proxyImport } from "@/lib/server/import-proxy";

// BFF proxy for the legacy compliance review history import:
// POST /api/customers/import/compliance-reviews/{preview|apply}. See import-proxy.ts.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ phase: string }> },
): Promise<NextResponse> {
  const { phase } = await ctx.params;
  return proxyImport(req, phase, "/api/customers/import/compliance-reviews");
}
