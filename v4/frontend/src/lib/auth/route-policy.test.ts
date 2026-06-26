import { describe, expect, it } from "vitest";
import { getRoutePolicy, roleHasAccess } from "./route-policy";

describe("getRoutePolicy", () => {
  it("returns 'public' for POST /api/auth/login", () => {
    expect(getRoutePolicy("POST", "/api/auth/login")).toBe("public");
  });

  it("returns 'public' for POST /api/auth/logout", () => {
    expect(getRoutePolicy("POST", "/api/auth/logout")).toBe("public");
  });

  it("returns 'api-key' for GET /api/attendance", () => {
    expect(getRoutePolicy("GET", "/api/attendance")).toBe("api-key");
  });

  it("returns 'admin' for POST /api/dotacion/sync", () => {
    expect(getRoutePolicy("POST", "/api/dotacion/sync")).toBe("admin");
  });

  it("returns 'supervisor' for POST /api/calendars", () => {
    expect(getRoutePolicy("POST", "/api/calendars")).toBe("supervisor");
  });

  it("returns 'admin' for PATCH /api/grupos/[id] (dynamic segment)", () => {
    expect(getRoutePolicy("PATCH", "/api/grupos/some-group-id")).toBe("admin");
  });

  it("returns 'admin' for DELETE /api/supervisores/[id] (dynamic segment)", () => {
    expect(getRoutePolicy("DELETE", "/api/supervisores/abc123")).toBe("admin");
  });

  it("returns undefined for unregistered route (deny by default)", () => {
    expect(getRoutePolicy("GET", "/api/unknown/route")).toBeUndefined();
  });

  it("is case-insensitive for method", () => {
    expect(getRoutePolicy("get", "/api/attendance")).toBe("api-key");
    expect(getRoutePolicy("Get", "/api/attendance")).toBe("api-key");
  });

  it("returns 'supervisor' for GET /api/calendars/export-group", () => {
    expect(getRoutePolicy("GET", "/api/calendars/export-group")).toBe("supervisor");
  });

  it("returns 'admin' for GET /api/calendars/export-masivo", () => {
    expect(getRoutePolicy("GET", "/api/calendars/export-masivo")).toBe("admin");
  });
});

describe("roleHasAccess", () => {
  it("'public' level grants access to everyone including undefined role", () => {
    expect(roleHasAccess(undefined, "public")).toBe(true);
    expect(roleHasAccess("vendedor", "public")).toBe(true);
    expect(roleHasAccess("supervisor", "public")).toBe(true);
    expect(roleHasAccess("admin", "public")).toBe(true);
  });

  it("'api-key' level grants access (route handles own auth)", () => {
    expect(roleHasAccess(undefined, "api-key")).toBe(true);
  });

  it("'authenticated' level denies undefined role", () => {
    expect(roleHasAccess(undefined, "authenticated")).toBe(false);
  });

  it("'authenticated' level grants access to any valid role", () => {
    expect(roleHasAccess("vendedor", "authenticated")).toBe(true);
    expect(roleHasAccess("supervisor", "authenticated")).toBe(true);
    expect(roleHasAccess("admin", "authenticated")).toBe(true);
  });

  it("'supervisor' level denies vendedor", () => {
    expect(roleHasAccess("vendedor", "supervisor")).toBe(false);
  });

  it("'supervisor' level grants supervisor and admin", () => {
    expect(roleHasAccess("supervisor", "supervisor")).toBe(true);
    expect(roleHasAccess("admin", "supervisor")).toBe(true);
  });

  it("'admin' level denies supervisor and vendedor", () => {
    expect(roleHasAccess("supervisor", "admin")).toBe(false);
    expect(roleHasAccess("vendedor", "admin")).toBe(false);
  });

  it("'admin' level only grants admin", () => {
    expect(roleHasAccess("admin", "admin")).toBe(true);
  });
});
