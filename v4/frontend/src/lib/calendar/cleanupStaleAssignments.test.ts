import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearWorkerFromFutureCalendars } from "./cleanupStaleAssignments";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    calendar: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAction: vi.fn(),
}));

function calendar(
  id: string,
  year: number,
  month: number,
  assignments: Record<string, string | null>,
  branchTeamId = "team-1",
  branchId = "branch-1",
) {
  return { id, year, month, assignments: JSON.stringify(assignments), branchTeamId, branchTeam: { branchId } };
}

describe("clearWorkerFromFutureCalendars", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("nulls out the worker's slot in a future calendar, updates assignedCount, and logs it", async () => {
    vi.mocked(prisma.calendar.findMany).mockResolvedValue([
      calendar("cal-august", 2026, 8, { "1": "worker-a", "2": "worker-b" }),
    ] as never);

    const cleaned = await clearWorkerFromFutureCalendars(["worker-a"]);

    expect(cleaned).toBe(1);
    expect(prisma.calendar.update).toHaveBeenCalledWith({
      where: { id: "cal-august" },
      data: { assignments: JSON.stringify({ "1": null, "2": "worker-b" }), assignedCount: 1 },
    });
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "calendar.assign", entityId: "cal-august", branchId: "branch-1" }),
    );
  });

  it("does not touch calendars where the worker is not assigned", async () => {
    vi.mocked(prisma.calendar.findMany).mockResolvedValue([
      calendar("cal-august", 2026, 8, { "1": "worker-b" }),
    ] as never);

    const cleaned = await clearWorkerFromFutureCalendars(["worker-a"]);

    expect(cleaned).toBe(0);
    expect(prisma.calendar.update).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });

  it("scopes the query to strictly-future year/month (excludes the current month) and an optional branchTeamId", async () => {
    vi.mocked(prisma.calendar.findMany).mockResolvedValue([]);

    await clearWorkerFromFutureCalendars(["worker-a"], "team-1");

    expect(prisma.calendar.findMany).toHaveBeenCalledWith({
      where: {
        branchTeamId: "team-1",
        OR: [{ year: { gt: 2026 } }, { year: 2026, month: { gt: 7 } }],
      },
      include: { branchTeam: { select: { branchId: true } } },
    });
  });

  it("returns 0 immediately when given no workerIds, without querying the database", async () => {
    const cleaned = await clearWorkerFromFutureCalendars([]);

    expect(cleaned).toBe(0);
    expect(prisma.calendar.findMany).not.toHaveBeenCalled();
  });
});
