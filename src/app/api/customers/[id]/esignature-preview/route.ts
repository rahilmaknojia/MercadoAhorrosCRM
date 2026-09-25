import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";

// BFF proxy for the merge preview (POST /api/customers/{id}/esignature-documents/preview).
// A Route Handler rather than a Server Action because the send dialog re-previews as the operator
// changes the template / pinned review: Server Actions dispatch one at a time per client and can't
// be aborted, while a fetch here can be cancelled when a newer preview supersedes it. The API
// resolves exactly like a send but writes nothing and never calls NinjaFlow.
const API = process.env.API_BASE_URL!;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!/^\d{1,18}$/.test(id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const jwt = await getJwt(req.headers.get("cookie"));
  if (!jwt) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const input = (await req.json().catch(() => null)) as
    | { templateId?: unknown; complianceReviewVersion?: unknown }
    | null;
  const templateId = Number(input?.templateId);
  const version = input?.complianceReviewVersion == null ? null : Number(input.complianceReviewVersion);
  if (!Number.isInteger(templateId) || templateId < 1 || (version !== null && (!Number.isInteger(version) || version < 1))) {
    return NextResponse.json({ message: "Invalid preview request." }, { status: 400 });
  }

  const res = await fetch(`${API}/api/customers/${id}/esignature-documents/preview`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(version === null ? { templateId } : { templateId, complianceReviewVersion: version }),
    cache: "no-store",
    signal: req.signal, // the browser aborting a stale preview cancels the upstream call too
  }).catch(() => null);

  if (!res) return NextResponse.json({ message: "Could not reach the API." }, { status: 502 });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body as { message?: string } | null)?.message ??
      (res.status === 403 ? "You don't have permission to preview this document." : "Could not load the preview.");
    return NextResponse.json({ message }, { status: res.status });
  }
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
