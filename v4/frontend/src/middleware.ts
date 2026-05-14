import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";

const ADMIN_ONLY = ["/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (session.role !== "admin") {
      const redirectTo = session.role === "vendedor" ? "/vendedor" : "/supervisor";
      return NextResponse.redirect(new URL(redirectTo, req.url));
    }

    const isAdminOnly = ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (isAdminOnly && session.role !== "admin") {
      return NextResponse.redirect(new URL("/supervisor", req.url));
    }

    const res = NextResponse.next();
    res.headers.set("x-user-role", session.role);
    res.headers.set("x-user-branch-ids", JSON.stringify(session.branchIds ?? []));
    return res;
  }

  if (pathname.startsWith("/supervisor")) {
    const session = await getSessionFromRequest(req);
    if (!session || (session.role !== "supervisor" && session.role !== "admin")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/vendedor")) {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== "vendedor") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/supervisor/:path*", "/vendedor/:path*", "/api/:path*"],
};
