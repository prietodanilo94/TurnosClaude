import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";
import { getSessionFromRequest } from "@/lib/auth/session";
import { assertTeamAccess } from "@/lib/auth/ownership";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    branchTeam: { findUnique: vi.fn() },
    calendar: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAction: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock("@/lib/auth/ownership", () => ({
  assertTeamAccess: vi.fn(),
}));

const ADMIN_SESSION = { email: "admin@pompeyo.cl", role: "admin" as const };

function request(body: unknown): Request {
  return new Request("http://localhost/api/calendars", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/calendars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionFromRequest).mockResolvedValue(ADMIN_SESSION as never);
    vi.mocked(assertTeamAccess).mockResolvedValue(true);
  });

  it("creates or updates a calendar and logs validation summary", async () => {
    vi.mocked(prisma.branchTeam.findUnique).mockResolvedValue({
      id: "team-1",
      branchId: "branch-1",
      areaNegocio: "ventas",
      categoria: null,
      categoriaSetAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.calendar.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.calendar.upsert).mockResolvedValue({
      id: "calendar-1",
      branchTeamId: "team-1",
      year: 2026,
      month: 5,
      slotsData: "[]",
      assignments: "{}",
      assignedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(request({
      teamId: "team-1",
      year: 2026,
      month: 5,
      slotsData: [],
      assignments: {},
      validationSummary: { errorCount: 1, warningCount: 0, warningCodes: [] },
    }) as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: "calendar-1" });
    expect(prisma.calendar.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchTeamId_year_month: { branchTeamId: "team-1", year: 2026, month: 5 } },
    }));
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({
      action: "calendar.generate",
      branchId: "branch-1",
      metadata: expect.objectContaining({
        teamId: "team-1",
        validationSummary: { errorCount: 1, warningCount: 0, warningCodes: [] },
      }),
    }));
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const res = await POST(request({
      teamId: "team-1",
      year: 2026,
      month: 5,
      slotsData: [],
      assignments: {},
    }) as never);

    expect(res.status).toBe(401);
    expect(prisma.calendar.upsert).not.toHaveBeenCalled();
  });

  it("returns 403 when supervisor lacks access to the team", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({
      email: "jefe@pompeyo.cl",
      role: "supervisor" as const,
      supervisorId: "sup-1",
      branchIds: [],
    } as never);
    vi.mocked(assertTeamAccess).mockResolvedValue(false);

    const res = await POST(request({
      teamId: "team-other",
      year: 2026,
      month: 5,
      slotsData: [],
      assignments: {},
    }) as never);

    expect(res.status).toBe(403);
    expect(prisma.calendar.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when body fails Zod validation", async () => {
    const res = await POST(request({
      teamId: "team-1",
      year: 9999,   // fuera del rango 2024-2035
      month: 13,    // mes invalido
      slotsData: "no-es-array",
      assignments: {},
    }) as never);

    expect(res.status).toBe(400);
    expect(prisma.calendar.upsert).not.toHaveBeenCalled();
  });

  it("returns 404 when the team does not exist", async () => {
    vi.mocked(prisma.branchTeam.findUnique).mockResolvedValue(null);

    const res = await POST(request({
      teamId: "missing-team",
      year: 2026,
      month: 5,
      slotsData: [],
      assignments: {},
    }) as never);

    expect(res.status).toBe(404);
    expect(prisma.calendar.upsert).not.toHaveBeenCalled();
  });
});
