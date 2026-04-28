import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const adminHash  = process.env.ADMIN_PASSWORD_HASH ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });
  }

  const emailMatch = email.toLowerCase() === adminEmail.toLowerCase();
  const passMatch  = adminHash ? await bcrypt.compare(password, adminHash) : password === process.env.ADMIN_PASSWORD;

  if (!emailMatch || !passMatch) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const token = await createSession({ email, role: "admin" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
