import { describe, expect, it } from "vitest";
import { splitCalendarByTeam } from "./teamSplit";
import type { CalendarSlot } from "@/types";

function slot(slotNumber: number): CalendarSlot {
  return {
    slotNumber,
    days: {
      "2026-05-04": { start: "10:00", end: "18:00" },
    },
  };
}

describe("splitCalendarByTeam", () => {
  it("splits combined group slots back into independent team calendars", () => {
    const result = splitCalendarByTeam(
      [slot(1), slot(2), slot(3), slot(4), slot(5)],
      {
        "1": "worker-a",
        "2": "worker-b",
        "3": "worker-c",
        "4": "worker-d",
        "5": null,
      },
      [
        { teamId: "team-citroen", workerIds: ["worker-a", "worker-b"] },
        { teamId: "team-nissan", workerIds: ["worker-c", "worker-d", "worker-e"] },
      ],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      teamId: "team-citroen",
      assignments: { "1": "worker-a", "2": "worker-b" },
    });
    expect(result[0].slots.map((s) => s.slotNumber)).toEqual([1, 2]);
    expect(result[1]).toMatchObject({
      teamId: "team-nissan",
      assignments: { "1": "worker-c", "2": "worker-d", "3": null },
    });
    expect(result[1].slots.map((s) => s.slotNumber)).toEqual([1, 2, 3]);
  });

  it("uses slotCount instead of workerIds.length when a team has fewer active workers than saved slots", () => {
    // Escenario real: DFSK tiene 4 slots guardados pero solo 3 trabajadores
    // activos hoy (uno fue desactivado sin regenerar). Sin slotCount, el
    // offset del siguiente equipo se calcularia con 3 en vez de 4, y sus
    // slots chocarian con el slot 4 (vacio) de DFSK.
    const result = splitCalendarByTeam(
      [slot(1), slot(2), slot(3), slot(4), slot(5), slot(6), slot(7)],
      {
        "1": "worker-a",
        "2": "worker-b",
        "3": "worker-c",
        "4": null,
        "5": "worker-d",
        "6": "worker-e",
        "7": "worker-f",
      },
      [
        { teamId: "team-dfsk", workerIds: ["worker-a", "worker-b", "worker-c"], slotCount: 4 },
        { teamId: "team-subaru", workerIds: ["worker-d", "worker-e", "worker-f"], slotCount: 3 },
      ],
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      teamId: "team-dfsk",
      assignments: { "1": "worker-a", "2": "worker-b", "3": "worker-c", "4": null },
    });
    expect(result[1]).toMatchObject({
      teamId: "team-subaru",
      assignments: { "1": "worker-d", "2": "worker-e", "3": "worker-f" },
    });
    // El slot 5 (combinado) = slot 1 de Subaru, sin colisionar con el slot 4 de DFSK.
    expect(result[1].slots.map((s) => s.slotNumber)).toEqual([1, 2, 3]);
  });
});
