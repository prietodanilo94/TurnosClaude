import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    branchTeam: { findUnique: vi.fn() },
    calendar: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAction: vi.fn(),
}));

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
  });

  it("creates or updates a calendar and logs validation summary", async () => {
    vi.mocked(prisma.branchTeam.findUnique).mockResolvedValue({ branchId: "branch-1" });
    vi.mocked(prisma.calendar.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.calendar.upsert).mockResolvedValue({
      id: "calendar-1",
      branchTeamId: "team-1",
      year: 2026,
      month: 5,
      slotsData: "[]",
      assignments: "{}",
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
    await expect(res.json()).resolves.toEqual({ error: "Equipo no encontrado" });
    expect(prisma.calendar.upsert).not.toHaveBeenCalled();
  });
});
