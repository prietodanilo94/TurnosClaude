"use client";

export function setRoleCookie(role: string) {
  document.cookie = `user_role=${role}; path=/; SameSite=Lax; max-age=86400`;
}

export function clearRoleCookie() {
  document.cookie = "user_role=; path=/; max-age=0";
}
