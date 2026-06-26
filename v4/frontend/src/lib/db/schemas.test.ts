import { describe, expect, it } from "vitest";
import {
  parseSlotsData,
  parseAssignments,
  parseRotationJson,
  parseWeeklyHoursJson,
} from "./schemas";

const VALID_DAY_SHIFT = { start: "09:00", end: "18:30" };
const VALID_WEEK = [VALID_DAY_SHIFT, null, VALID_DAY_SHIFT, null, VALID_DAY_SHIFT, null, null];

describe("parseSlotsData", () => {
  it("parses a valid slotsData array", () => {
    const raw = JSON.stringify([
      { slotNumber: 1, days: { "2026-06-01": VALID_DAY_SHIFT, "2026-06-02": null } },
    ]);
    const result = parseSlotsData(raw);
    expect(result).toHaveLength(1);
    expect(result[0].slotNumber).toBe(1);
    expect(result[0].days["2026-06-01"]).toEqual(VALID_DAY_SHIFT);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseSlotsData("not-json")).toThrow(/JSON\.parse/i);
  });

  it("throws when slotNumber is not a positive integer", () => {
    const raw = JSON.stringify([{ slotNumber: 0, days: {} }]);
    expect(() => parseSlotsData(raw)).toThrow();
  });
});

describe("parseAssignments", () => {
  it("parses valid assignments record", () => {
    const raw = JSON.stringify({ "1": "worker-abc", "2": null });
    const result = parseAssignments(raw);
    expect(result["1"]).toBe("worker-abc");
    expect(result["2"]).toBeNull();
  });

  it("parses an empty object", () => {
    expect(parseAssignments("{}")).toEqual({});
  });

  it("throws on non-object input", () => {
    expect(() => parseAssignments('"string"')).toThrow();
  });
});

describe("parseRotationJson", () => {
  it("parses a single-week rotation", () => {
    const raw = JSON.stringify([VALID_WEEK]);
    const result = parseRotationJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(7);
  });

  it("parses a 4-week rotation", () => {
    const raw = JSON.stringify([VALID_WEEK, VALID_WEEK, VALID_WEEK, VALID_WEEK]);
    const result = parseRotationJson(raw);
    expect(result).toHaveLength(4);
  });

  it("throws when WeekPattern has wrong length (< 7)", () => {
    const raw = JSON.stringify([[null, null, null]]);
    expect(() => parseRotationJson(raw)).toThrow();
  });

  it("throws on empty rotation array", () => {
    expect(() => parseRotationJson("[]")).toThrow();
  });

  it("throws when DayShift has bad time format", () => {
    const badShift = { start: "9:00", end: "18:00" }; // single-digit hour
    const raw = JSON.stringify([[badShift, null, null, null, null, null, null]]);
    expect(() => parseRotationJson(raw)).toThrow();
  });
});

describe("parseWeeklyHoursJson", () => {
  it("parses a valid hours array", () => {
    const raw = JSON.stringify([45, 45, 45, 45]);
    const result = parseWeeklyHoursJson(raw);
    expect(result).toEqual([45, 45, 45, 45]);
  });

  it("parses an empty array", () => {
    expect(parseWeeklyHoursJson("[]")).toEqual([]);
  });

  it("throws when array contains negative numbers", () => {
    expect(() => parseWeeklyHoursJson("[-1, 45]")).toThrow();
  });

  it("throws when array contains strings", () => {
    expect(() => parseWeeklyHoursJson('["45"]')).toThrow();
  });
});
