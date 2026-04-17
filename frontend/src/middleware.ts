import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get("user_role")?.value;

  if (pathname.startsWith("/admin")) {
    if (!role) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/jefe", request.url));
    }
  }

  if (pathname.startsWith("/jefe")) {
    if (!role) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (role !== "jefesucursal") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/jefe/:path*"],
};
