import { NextRequest, NextResponse } from "next/server";
import { getJwt } from "@/lib/server/auth";

// BFF proxy for the .NET API's /api/fileupload/* endpoints. The browser drives the
// multipart S3 flow (initiate -> get part URLs -> PUT parts directly to S3 -> complete)
// and the gallery (list -> presigned view URLs -> delete); every API call is proxied
// here so the server can attach the Bearer JWT. The actual byte PUTs go browser->S3.
const API = process.env.API_BASE_URL!;

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const jwt = await getJwt(req.headers.get("cookie"));
  if (!jwt) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const target = `${API}/api/fileupload/${path.join("/")}${req.nextUrl.search}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${jwt}` };

  const init: RequestInit = { method: req.method, headers, cache: "no-store" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.text();
    if (body) {
      init.body = body;
      headers["Content-Type"] = req.headers.get("content-type") || "application/json";
    }
  }

  const res = await fetch(target, init).catch(() => null);
  if (!res) {
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
