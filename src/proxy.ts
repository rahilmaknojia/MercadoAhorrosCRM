import { NextRequest, NextResponse } from "next/server";

// Fast cookie-presence gate. Real session validation happens server-side in the
// authenticated layout (which calls the auth service). Better Auth's session cookie
// is named "*session_token" (optionally with a __Secure- prefix in production).
function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some((c) => c.name.includes("session_token"));
}

export function proxy(req: NextRequest) {
  const isLogin = req.nextUrl.pathname.startsWith("/login");
  const authed = hasSessionCookie(req);

  if (!authed && !isLogin) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (authed && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
