"use client";

import { APPWRITE_SESSION_COOKIE } from "@/lib/auth/constants";

export { APPWRITE_SESSION_COOKIE };

export function setRoleCookie(role: string) {
  document.cookie = `user_role=${role}; path=/; SameSite=Lax; max-age=86400`;
}

export function clearRoleCookie() {
  document.cookie = "user_role=; path=/; max-age=0";
}

export function clearAppwriteSessionCookie() {
  document.cookie = `${APPWRITE_SESSION_COOKIE}=; path=/; max-age=0`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }

  return null;
}

export function getAppwriteSessionCookie(): string | null {
  return getCookie(APPWRITE_SESSION_COOKIE);
}
