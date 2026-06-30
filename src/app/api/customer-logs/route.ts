import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";

// Read-only BFF proxy for a customer's activity log, paginated. Builds the upstream
// query server-side (only customerId + paging are accepted) and attaches the Bearer JWT.
const API = process.env.API_BASE_URL!;

export async function GET(req: NextRequest) {
  const jwt = await getJwt(req.headers.get("cookie"));
  if (!jwt) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const customerId = sp.get("customerId") ?? "";
  if (!/^\d+$/.test(customerId)) {
    return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
  }
  const pageNumber = /^\d+$/.test(sp.get("pageNumber") ?? "") ? sp.get("pageNumber")! : "1";
  const pageSize = /^\d+$/.test(sp.get("pageSize") ?? "") ? sp.get("pageSize")! : "10";

  const url =
    `${API}/api/customerlogs?filters=${encodeURIComponent(`customerId|exact|${customerId}`)}` +
    `&sortField=createdOn&ascending=false&pageNumber=${pageNumber}&pageSize=${pageSize}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });

  const text = await res.text();
  const headers: Record<string, string> = {
    "Content-Type": res.headers.get("content-type") || "application/json",
  };
  const pagination = res.headers.get("x-pagination");
  if (pagination) headers["X-Pagination"] = pagination;
  return new NextResponse(text, { status: res.status, headers });
}
