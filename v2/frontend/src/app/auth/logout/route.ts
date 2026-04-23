import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_SESSION_COOKIE } from "@/lib/auth/constants";

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const PROJECT_SESSION_COOKIE = `a_session_${APPWRITE_PROJECT_ID}`;
const COOKIE_SECURE = process.env.NODE_ENV === "production";

function getSessionFallback(secret: string) {
  return JSON.stringify({ [PROJECT_SESSION_COOKIE]: secret });
}

export async function POST(request: NextRequest) {
  const rawSecret = request.cookies.get(APPWRITE_SESSION_COOKIE)?.value;
  const sessionSecret = rawSecret ? decodeURIComponent(rawSecret) : null;

  if (sessionSecret) {
    await fetch(`${APPWRITE_ENDPOINT}/account/sessions/current`, {
      method: "DELETE",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Fallback-Cookies": getSessionFallback(sessionSecret),
      },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(APPWRITE_SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    httpOnly: false,
  });
  response.cookies.set("user_role", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    httpOnly: false,
  });
  return response;
}
