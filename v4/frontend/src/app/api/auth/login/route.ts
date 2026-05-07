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

  const normalizedEmail = String(email).trim().toLowerCase();

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const isAdmin =
    normalizedEmail === adminEmail.toLowerCase() &&
    (adminHash ? await bcrypt.compare(password, adminHash) : password === process.env.ADMIN_PASSWORD);

  if (isAdmin) {
    const token = await createSession({ email: normalizedEmail, role: "admin" });
    const res = NextResponse.json({ ok: true, role: "admin" });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  }

  if (normalizedEmail.includes("@")) {
    const supervisor = await prisma.supervisor.findUnique({
      where: { email: normalizedEmail },
      include: { branches: { select: { branchId: true } } },
    });

    if (supervisor && supervisor.activo) {
      // Primera vez: sin contraseña guardada → guardar la que ingresaron y crear sesión
      if (!supervisor.passwordHash) {
        const passwordHash = await bcrypt.hash(password, 12);
        await prisma.supervisor.update({ where: { id: supervisor.id }, data: { passwordHash } });
      } else if (!await bcrypt.compare(password, supervisor.passwordHash)) {
        return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
      }

      const token = await createSession({
        email: supervisor.email ?? normalizedEmail,
        role: "supervisor",
        supervisorId: supervisor.id,
        branchIds: supervisor.branches.map((branch) => branch.branchId),
        nombre: supervisor.nombre,
      });
      const res = NextResponse.json({ ok: true, role: "supervisor" });
      res.cookies.set(sessionCookieOptions(token));
      return res;
    }

    const legacyUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { branches: { select: { branchId: true } } },
    });

    if (legacyUser && legacyUser.activo && await bcrypt.compare(password, legacyUser.passwordHash)) {
      const token = await createSession({
        email: legacyUser.email,
        role: "supervisor",
        userId: legacyUser.id,
        branchIds: legacyUser.branches.map((branch) => branch.branchId),
        nombre: legacyUser.nombre,
      });
      const res = NextResponse.json({ ok: true, role: "supervisor" });
      res.cookies.set(sessionCookieOptions(token));
      return res;
    }

    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

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
