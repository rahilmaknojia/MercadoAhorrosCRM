import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";

const API = process.env.API_BASE_URL!;

/**
 * Streams a document's sealed PDF from the .NET API (which fetches it from NinjaFlow). This is a
 * BFF proxy: the browser hits this route, we attach the server-side JWT, and pipe the PDF back —
 * inline by default (browser PDF viewer), or as an attachment with `?download=true`. `skip` is a
 * comma-separated list of 1-based pages to omit from the exported file.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; documentId: string }> }
) {
  const { documentId } = await ctx.params;
  // Numeric-only: this is interpolated into the upstream API URL. The API is responsible for
  // authorizing that the document belongs to a customer the caller may access.
  if (!/^\d+$/.test(documentId)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }
  const jwt = await getJwt(req.headers.get("cookie"));
  if (!jwt) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const inUrl = new URL(req.url);
  const qs = new URLSearchParams();
  if (inUrl.searchParams.get("download") === "true") qs.set("download", "true");
  const skip = inUrl.searchParams.get("skip");
  if (skip) qs.set("skip", skip);

  const res = await fetch(
    `${API}/api/esignature-documents/${documentId}/download?${qs.toString()}`,
    { headers: { Authorization: `Bearer ${jwt}` }, cache: "no-store" }
  ).catch(() => null);

  if (!res || !res.ok) {
    const message = res
      ? await res.json().then((b) => b?.message).catch(() => null)
      : "Could not reach the API.";
    return NextResponse.json({ error: message ?? "Could not load the document." }, { status: res?.status ?? 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", res.headers.get("content-type") ?? "application/pdf");
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(res.body, { status: 200, headers });
}
