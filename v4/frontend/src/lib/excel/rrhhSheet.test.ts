import { describe, expect, it } from "vitest";
import { rutSinDV, buildRrhhRow, rrhhRowsFromTeam } from "./rrhhSheet";

describe("rutSinDV", () => {
  it("strips the check digit", () => {
    expect(rutSinDV("12345678-9")).toBe("12345678");
  });
});

describe("buildRrhhRow", () => {
  it("fills 31 day columns, empty when libre", () => {
    const row = buildRrhhRow("11111111-1", 2026, 7, {
      "2026-07-01": { start: "10:00", end: "18:00" },
    });
    expect(row).toHaveLength(32); // RUT + 31 dias
    expect(row[0]).toBe("11111111");
    expect(row[1]).toBe("10:00 a 18:00");
    expect(row[2]).toBe("");
  });
});

describe("rrhhRowsFromTeam", () => {
  const slots = [
    { slotNumber: 1, days: { "2026-07-01": { start: "10:00", end: "18:00" } } },
    { slotNumber: 2, days: { "2026-07-01": null } },
  ];
  const assignments = { "1": "w1", "2": "w2" };
  const workerRutMap = { w1: "11111111-1", w2: "22222222-2" };

  it("returns one row per assigned worker with a rut", () => {
    const rows = rrhhRowsFromTeam(2026, 7, slots as never, assignments, workerRutMap);
    expect(rows).toHaveLength(2);
  });

  it("filters by workerIds when provided", () => {
    const rows = rrhhRowsFromTeam(2026, 7, slots as never, assignments, workerRutMap, new Set(["w1"]));
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("11111111");
  });

  it("skips slots without a rut", () => {
    const rows = rrhhRowsFromTeam(2026, 7, slots as never, assignments, { w1: "11111111-1" });
    expect(rows).toHaveLength(1);
  });
});
