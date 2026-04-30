import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";

const ADMIN_ONLY = ["/admin/dotacion", "/admin/usuarios"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const isAdminOnly = ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (isAdminOnly && session.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/sucursales", req.url));
    }

    const res = NextResponse.next();
    res.headers.set("x-user-role", session.role);
    res.headers.set("x-user-branch-ids", JSON.stringify(session.branchIds ?? []));
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
