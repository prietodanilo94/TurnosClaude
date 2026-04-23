import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_SESSION_COOKIE } from "@/lib/auth/constants";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const PROJECT_SESSION_COOKIE = `a_session_${APPWRITE_PROJECT_ID}`;
const COOKIE_SECURE = process.env.NODE_ENV === "production";

function getSessionFallback(secret: string) {
  return JSON.stringify({ [PROJECT_SESSION_COOKIE]: secret });
}

function getSessionSecret(fallbackCookies: string | null): string | null {
  if (!fallbackCookies) return null;

  try {
    const parsed = JSON.parse(fallbackCookies) as Record<string, string>;
    return parsed[PROJECT_SESSION_COOKIE] ?? null;
  } catch {
    return null;
  }
}

async function deleteCurrentSession(secret: string) {
  await fetch(`${APPWRITE_ENDPOINT}/account/sessions/current`, {
    method: "DELETE",
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Fallback-Cookies": getSessionFallback(secret),
    },
    cache: "no-store",
  }).catch(() => undefined);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { message: "Debes ingresar email y contraseña." },
      { status: 400 }
    );
  }

  const sessionResponse = await fetch(`${APPWRITE_ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const sessionPayload = await sessionResponse.json().catch(() => null);
  const sessionSecret =
    (typeof sessionPayload?.secret === "string" ? sessionPayload.secret : null) ??
    getSessionSecret(sessionResponse.headers.get("x-fallback-cookies"));

  if (!sessionResponse.ok || !sessionSecret) {
    const message =
      typeof sessionPayload?.message === "string"
        ? sessionPayload.message
        : "No fue posible iniciar sesión.";
    const status = sessionResponse.status === 401 ? 401 : 400;
    return NextResponse.json({ message }, { status });
  }

  const accountResponse = await fetch(`${APPWRITE_ENDPOINT}/account`, {
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Fallback-Cookies": getSessionFallback(sessionSecret),
    },
    cache: "no-store",
  });

  const accountPayload = await accountResponse.json().catch(() => null);
  const labels = Array.isArray(accountPayload?.labels) ? accountPayload.labels : [];
  const role = labels.includes("admin")
    ? "admin"
    : labels.includes("jefesucursal")
      ? "jefesucursal"
      : null;

  if (!accountResponse.ok || !role) {
    await deleteCurrentSession(sessionSecret);
    return NextResponse.json(
      { message: "Tu cuenta no tiene un rol asignado." },
      { status: 403 }
    );
  }

  const maxAgeSeconds = (() => {
    const expire = sessionPayload?.expire;
    const expiresAt = typeof expire === "string" ? Date.parse(expire) : NaN;
    if (Number.isNaN(expiresAt)) return 60 * 60 * 24 * 7;
    return Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
  })();

  const response = NextResponse.json({ role });
  response.cookies.set(APPWRITE_SESSION_COOKIE, encodeURIComponent(sessionSecret), {
    path: "/",
    maxAge: maxAgeSeconds,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    httpOnly: false,
  });
  response.cookies.set("user_role", role, {
    path: "/",
    maxAge: maxAgeSeconds,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    httpOnly: false,
  });
  return response;
}
