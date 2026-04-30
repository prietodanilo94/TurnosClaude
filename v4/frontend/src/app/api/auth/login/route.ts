import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

function normalizeRut(raw: string): string | null {
  const clean = raw.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (clean.length < 2) return null;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return null;
  return `${body}-${dv}`;
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });
  }

  // ── Admin (env vars) ──
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminHash  = process.env.ADMIN_PASSWORD_HASH ?? "";
  const isAdmin =
    email.toLowerCase() === adminEmail.toLowerCase() &&
    (adminHash ? await bcrypt.compare(password, adminHash) : password === process.env.ADMIN_PASSWORD);

  if (isAdmin) {
    const token = await createSession({ email, role: "admin" });
    const res = NextResponse.json({ ok: true, role: "admin" });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  }

  // ── Jefe de sucursal (DB User) ──
  if (email.includes("@")) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { branches: { select: { branchId: true } } },
    });

    if (user && user.activo && await bcrypt.compare(password, user.passwordHash)) {
      const token = await createSession({
        email: user.email,
        role: "jefe",
        userId: user.id,
        branchIds: user.branches.map((b) => b.branchId),
      });
      const res = NextResponse.json({ ok: true, role: "jefe" });
      res.cookies.set(sessionCookieOptions(token));
      return res;
    }
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  // ── Vendedor (Worker por RUT) ──
  const rut = normalizeRut(email);
  if (rut) {
    const worker = await prisma.worker.findUnique({
      where: { rut },
    });

    if (worker && worker.activo && worker.passwordHash && await bcrypt.compare(password, worker.passwordHash)) {
      const token = await createSession({
        email: worker.rut,
        role: "vendedor",
        workerId: worker.id,
        nombre: worker.nombre,
      });
      const res = NextResponse.json({ ok: true, role: "vendedor" });
      res.cookies.set(sessionCookieOptions(token));
      return res;
    }
  }

  return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
}
