import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";

// BFF proxy for a compliance review's rep signature, so a plain <img src> works: the browser
// sends the session cookie here, and this attaches the Bearer JWT and streams the PNG from
// GET /api/customers/{id}/compliance-review/versions/{v}/signature. The API applies the
// member-scope rules (404 when out of scope or unsigned).
const API = process.env.API_BASE_URL!;

type Ctx = { params: Promise<{ id: string; version: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id, version } = await ctx.params;
  // Both are interpolated into the upstream URL — digits only.
  if (!/^\d{1,18}$/.test(id) || !/^\d{1,9}$/.test(version)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const jwt = await getJwt(req.headers.get("cookie"));
  if (!jwt) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const res = await fetch(`${API}/api/customers/${id}/compliance-review/versions/${version}/signature`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  }).catch(() => null);

  if (!res) return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: res.status === 404 ? "No signature" : "Could not load signature" }, { status: res.status === 404 ? 404 : 502 });
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/png",
      // A version's signature never changes once submitted; keep it out of shared caches.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
