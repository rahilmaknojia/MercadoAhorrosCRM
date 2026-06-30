import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";

// Read-only BFF proxy for report data so the builder can fetch live previews from
// the browser. Forwards GET to the .NET API with the Bearer JWT. Allow-listed paths
// only (customer list + aggregation), never arbitrary API routes.
const API = process.env.API_BASE_URL!;
const ALLOWED = new Set([
  "customers",
  "reports/customers/aggregate",
  "reports/customers/aggregate-2d",
]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join("/");
  if (!ALLOWED.has(path)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const jwt = await getJwt(req.headers.get("cookie"));
  if (!jwt) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const res = await fetch(`${API}/api/${path}${req.nextUrl.search}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });

  const text = await res.text();
  // Forward the X-Pagination header so the client can read TotalCount.
  const headers: Record<string, string> = {
    "Content-Type": res.headers.get("content-type") || "application/json",
  };
  const pagination = res.headers.get("x-pagination");
  if (pagination) headers["X-Pagination"] = pagination;
  return new NextResponse(text, { status: res.status, headers });
}
