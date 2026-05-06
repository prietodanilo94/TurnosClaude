import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { middleware } from "./middleware";

vi.mock("@/lib/auth/session", () => ({
  getSessionFromRequest: vi.fn(),
}));

function nextReq(pathname: string): NextRequest {
  return new NextRequest(`https://turnos4.dpmake.cl${pathname}`);
}

describe("middleware access smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous supervisor access to login", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const res = await middleware(nextReq("/supervisor"));

    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toBe("https://turnos4.dpmake.cl/login");
  });

  it("redirects supervisors away from admin routes", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({
      email: "jefe@pompeyo.cl",
      role: "supervisor",
      supervisorId: "supervisor-1",
      branchIds: ["branch-1"],
    });

    const res = await middleware(nextReq("/admin/historial"));

    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toBe("https://turnos4.dpmake.cl/supervisor");
  });

  it("allows admin access to admin routes", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({
      email: "admin@pompeyo.cl",
      role: "admin",
    });

    const res = await middleware(nextReq("/admin/historial"));

    expect(res?.status).toBe(200);
    expect(res?.headers.get("x-user-role")).toBe("admin");
  });
});
