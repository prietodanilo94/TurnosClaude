import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearWorkerFromFutureCalendars } from "./cleanupStaleAssignments";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    calendar: { findMany: vi.fn(), update: vi.fn() },
  },
}));

function calendar(id: string, year: number, month: number, assignments: Record<string, string | null>) {
  return { id, year, month, assignments: JSON.stringify(assignments) };
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

  it("nulls out the worker's slot in current/future calendars and updates assignedCount", async () => {
    vi.mocked(prisma.calendar.findMany).mockResolvedValue([
      calendar("cal-july", 2026, 7, { "1": "worker-a", "2": "worker-b" }),
    ] as never);

    const cleaned = await clearWorkerFromFutureCalendars(["worker-a"]);

    expect(cleaned).toBe(1);
    expect(prisma.calendar.update).toHaveBeenCalledWith({
      where: { id: "cal-july" },
      data: { assignments: JSON.stringify({ "1": null, "2": "worker-b" }), assignedCount: 1 },
    });
  });

  it("does not touch calendars where the worker is not assigned", async () => {
    vi.mocked(prisma.calendar.findMany).mockResolvedValue([
      calendar("cal-july", 2026, 7, { "1": "worker-b" }),
    ] as never);

    const cleaned = await clearWorkerFromFutureCalendars(["worker-a"]);

    expect(cleaned).toBe(0);
    expect(prisma.calendar.update).not.toHaveBeenCalled();
  });

  it("scopes the query to past-excluded year/month and an optional branchTeamId", async () => {
    vi.mocked(prisma.calendar.findMany).mockResolvedValue([]);

    await clearWorkerFromFutureCalendars(["worker-a"], "team-1");

    expect(prisma.calendar.findMany).toHaveBeenCalledWith({
      where: {
        branchTeamId: "team-1",
        OR: [{ year: { gt: 2026 } }, { year: 2026, month: { gte: 7 } }],
      },
    });
  });

  it("returns 0 immediately when given no workerIds, without querying the database", async () => {
    const cleaned = await clearWorkerFromFutureCalendars([]);

    expect(cleaned).toBe(0);
    expect(prisma.calendar.findMany).not.toHaveBeenCalled();
  });
});
