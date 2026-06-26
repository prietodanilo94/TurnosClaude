import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE = "v4_session";
const ALG = "HS256";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no configurado");
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  email: string;
  role: "admin" | "supervisor" | "vendedor";
  userId?: string;
  supervisorId?: string;
  branchIds?: string[];
  workerId?: string;
  nombre?: string;
  // tokenVersion: versión al momento del login. Para invalidar sesiones activas,
  // incrementar Supervisor.tokenVersion en DB — el token queda stale en el próximo check.
  tokenVersion?: number;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Verifica que el tokenVersion del JWT coincide con el DB.
 * Usar en rutas sensibles (cambio de password, operaciones admin críticas).
 * NO disponible en middleware (Edge runtime no soporta Prisma).
 *
 * Retorna false si el supervisor fue desactivado o su tokenVersion fue bumpeado.
 */
export async function isSessionFresh(session: SessionPayload): Promise<boolean> {
  if (session.role !== "supervisor" || !session.supervisorId) return true;
  if (session.tokenVersion === undefined) return true; // tokens legacy sin versión = aceptar

  const { prisma } = await import("@/lib/db/prisma");
  const sup = await prisma.supervisor.findUnique({
    where: { id: session.supervisorId },
    select: { tokenVersion: true, activo: true },
  });

  if (!sup || !sup.activo) return false;
  return sup.tokenVersion === session.tokenVersion;
}

/**
 * Invalida todas las sesiones activas de un supervisor incrementando tokenVersion.
 * Llamar en: cambio de contraseña, desactivación, revocación de acceso.
 */
export async function bumpTokenVersion(supervisorId: string): Promise<void> {
  const { prisma } = await import("@/lib/db/prisma");
  await prisma.supervisor.update({
    where: { id: supervisorId },
    data: { tokenVersion: { increment: 1 } },
  });
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 12,
    path: "/",
  };
}

export function clearSessionCookie() {
  return { name: COOKIE, value: "", maxAge: 0, path: "/" };
}
