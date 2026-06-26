import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { getRoutePolicy, roleHasAccess } from "@/lib/auth/route-policy";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Páginas admin ────────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (session.role !== "admin") {
      const redirectTo = session.role === "vendedor" ? "/vendedor" : "/supervisor";
      return NextResponse.redirect(new URL(redirectTo, req.url));
    }
    const res = NextResponse.next();
    res.headers.set("x-user-role", session.role);
    res.headers.set("x-user-branch-ids", JSON.stringify(session.branchIds ?? []));
    return res;
  }

  // ── Páginas supervisor ───────────────────────────────────────────────────────
  if (pathname.startsWith("/supervisor")) {
    const session = await getSessionFromRequest(req);
    if (!session || (session.role !== "supervisor" && session.role !== "admin")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // ── Páginas vendedor ─────────────────────────────────────────────────────────
  if (pathname.startsWith("/vendedor")) {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== "vendedor") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // ── API: deny by default vía ROUTE_POLICY ────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const policy = getRoutePolicy(req.method, pathname);

    // Ruta no registrada → 403 (deny by default)
    if (policy === undefined) {
      return NextResponse.json(
        { error: "Ruta no registrada en ROUTE_POLICY" },
        { status: 403 },
      );
    }

    // Rutas públicas: pasar sin verificar sesión
    if (policy === "public") return NextResponse.next();

    // Rutas con API key propia: la ruta handler se encarga de verificar
    if (policy === "api-key") return NextResponse.next();

    // Para el resto, se requiere sesión válida
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!roleHasAccess(session.role, policy)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/supervisor/:path*", "/vendedor/:path*", "/api/:path*"],
};
