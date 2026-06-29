import { NextRequest, NextResponse } from "next/server";

// Fast cookie-presence gate. Real session validation happens server-side in the
// authenticated layout (which calls the auth service). Better Auth's session cookie
// is named "*session_token" (optionally with a __Secure- prefix in production).
function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some((c) => c.name.includes("session_token"));
}

// Public auth routes reachable without a session. Note we do NOT redirect an
// already-"authed" (cookie-present) user away from these here — that branch, combined
// with the layout's real session validation, loops forever on a stale/expired cookie.
// The pages themselves validate the session and redirect authed users home.
const PUBLIC_PATHS = ["/login", "/reset", "/sign-up"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const authed = hasSessionCookie(req);

  if (!authed && !isPublic) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and public static assets. Static files
  // (logo, favicon, icons) must be excluded: the image optimizer fetches the original
  // server-side without the session cookie, and gating it would 307 → break the asset.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif)$).*)",
  ],
};
