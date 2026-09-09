import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";
import { isPrivileged } from "@/lib/server/authz";

// BFF proxy for the .NET API's member-import endpoints.
//
// A route handler rather than a server action, which is otherwise the house rule for every
// mutation: server actions are capped at Next's 1 MB body limit and the export is a few MB of
// CSV. Same reason the file-upload and report-export proxies are route handlers.
//
// Note this deliberately does NOT use `apiFetch` from @/lib/server/api: that helper stamps
// `Content-Type: application/json` onto any request carrying a body, which would misdeclare the
// CSV and break model binding upstream. Raw fetch + getJwt is what the other proxies do.
const API = process.env.API_BASE_URL!;

const PHASES = new Set(["preview", "apply"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ phase: string }> },
): Promise<NextResponse> {
  const { phase } = await ctx.params;

  if (!PHASES.has(phase)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // A route handler is a public POST endpoint; hiding the nav link gates nothing. The API
  // enforces `customers:import` too, but this is the near gate.
  if (!(await isPrivileged())) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const jwt = await getJwt(req.headers.get("cookie"));
  if (!jwt) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.text();
  if (!body.trim()) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  // fileSha256 / planFingerprint ride through on the query string for `apply`.
  const target = `${API}/api/customers/import/${phase}${req.nextUrl.search}`;

  const res = await fetch(target, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "text/csv" },
    body,
    cache: "no-store",
  }).catch(() => null);

  if (!res) {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  });
}
