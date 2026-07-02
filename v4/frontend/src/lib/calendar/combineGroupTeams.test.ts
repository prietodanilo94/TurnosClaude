import { describe, expect, it, vi } from "vitest";
import { combineGroupTeams } from "./combineGroupTeams";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { worker: { update: vi.fn() } },
}));

function slot(slotNumber: number) {
  return { slotNumber, days: { "2026-07-02": { start: "10:00", end: "18:00" } } };
}

describe("combineGroupTeams", () => {
  it("combines two teams into one slot/assignment table without offset collisions", async () => {
    const teams = [
      {
        id: "team-a",
        workers: [
          { id: "w1", nombre: "Ana", rotationAnchor: 0 },
          { id: "w2", nombre: "Beto", rotationAnchor: 1 },
        ],
        calendar: {
          slotsData: JSON.stringify([slot(1), slot(2), slot(3), slot(4)]), // 4 slots guardados
          assignments: JSON.stringify({ "1": "w1", "2": "w2", "3": null, "4": null }),
        },
      },
      {
        id: "team-b",
        workers: [{ id: "w3", nombre: "Caro", rotationAnchor: 0 }],
        calendar: {
          slotsData: JSON.stringify([slot(1)]),
          assignments: JSON.stringify({ "1": "w3" }),
        },
      },
    ];

    const result = await combineGroupTeams(teams, 2026, 7, null, undefined);

    // team-a aporta 4 slots (no 2, aunque solo tenga 2 trabajadores activos hoy)
    expect(result.slots.map((s) => s.slotNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(result.assignments).toEqual({ "1": "w1", "2": "w2", "3": null, "4": null, "5": "w3" });
    expect(result.slices).toEqual([
      { teamId: "team-a", workerIds: ["w1", "w2"], slotCount: 4, rotationAnchors: [0, 1] },
      { teamId: "team-b", workerIds: ["w3"], slotCount: 1, rotationAnchors: [0] },
    ]);
    expect(result.hasCalendar).toBe(true);
  });

  it("reports hasCalendar false when no team has a saved calendar", async () => {
    const teams = [
      { id: "team-a", workers: [{ id: "w1", nombre: "Ana", rotationAnchor: 0 }], calendar: null },
    ];

    const result = await combineGroupTeams(teams, 2026, 7, null, undefined);

    expect(result.hasCalendar).toBe(false);
    expect(result.slots).toEqual([]);
  });
});
