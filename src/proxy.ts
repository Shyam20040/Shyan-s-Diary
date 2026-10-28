import { NextRequest, NextResponse } from "next/server";

import {
  isValidOwnerSession,
  OWNER_SESSION_COOKIE,
} from "@/lib/security/owner-session";

const publicPaths = new Set([
  "/access",
  "/setup-required",
  "/api/access/login",
  "/api/jobs/daily-report",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    publicPaths.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.APP_ACCESS_PASSWORD || !process.env.APP_SESSION_SECRET) {
      return NextResponse.redirect(new URL("/setup-required", request.url));
    }

    if (!isValidOwnerSession(request.cookies.get(OWNER_SESSION_COOKIE)?.value)) {
      return NextResponse.redirect(new URL("/access", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
