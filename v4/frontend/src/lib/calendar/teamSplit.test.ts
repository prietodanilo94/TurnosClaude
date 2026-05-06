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
});
