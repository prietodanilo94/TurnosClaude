import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminHash  = process.env.ADMIN_PASSWORD_HASH ?? "";
  const isAdmin =
    email.toLowerCase() === adminEmail.toLowerCase() &&
    (adminHash ? await bcrypt.compare(password, adminHash) : password === process.env.ADMIN_PASSWORD);

  if (isAdmin) {
    const token = await createSession({ email, role: "admin" });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  }

  // Buscar jefe de sucursal en DB
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { branches: { select: { branchId: true } } },
  });

  if (!user || !user.activo) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const passOk = await bcrypt.compare(password, user.passwordHash);
  if (!passOk) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const token = await createSession({
    email: user.email,
    role: "jefe",
    userId: user.id,
    branchIds: user.branches.map((b) => b.branchId),
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
