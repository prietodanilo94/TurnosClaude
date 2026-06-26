import { describe, expect, it } from "vitest";
import { buildCalendarUrl } from "./log";
import { parseMetadata, fmtDetail } from "./format";

// Base URL usada en buildCalendarUrl cuando APP_URL no está definida
const BASE = "https://teamplanner.pompeyo.cl";

describe("buildCalendarUrl", () => {
  it("returns null when branchId is null", () => {
    expect(buildCalendarUrl(null, { year: 2026, month: 6, teamId: "team-1" })).toBeNull();
  });

  it("returns branch-only URL when year/month missing", () => {
    expect(buildCalendarUrl("branch-1", null)).toBe(`${BASE}/admin/sucursales/branch-1`);
    expect(buildCalendarUrl("branch-1", { teamId: "team-1" })).toBe(`${BASE}/admin/sucursales/branch-1`);
  });

  it("returns branch URL when teamId missing", () => {
    expect(buildCalendarUrl("branch-1", { year: 2026, month: 6 })).toBe(
      `${BASE}/admin/sucursales/branch-1`,
    );
  });

  it("returns full calendar URL with team param when all fields present", () => {
    const url = buildCalendarUrl("branch-abc", { year: 2026, month: 6, teamId: "team-xyz" });
    expect(url).toBe(`${BASE}/admin/sucursales/branch-abc/calendario/2026/6?team=team-xyz`);
  });
});

describe("parseMetadata", () => {
  it("parses a valid JSON string", () => {
    expect(parseMetadata('{"year":2026,"month":6}')).toEqual({ year: 2026, month: 6 });
  });

  it("returns null for invalid JSON", () => {
    expect(parseMetadata("{broken")).toBeNull();
    expect(parseMetadata(null)).toBeNull();
  });
});

describe("fmtDetail — calendar actions", () => {
  const meta = { year: 2026, month: 6, scopeLabel: "Citroën Santiago", scopeType: "branch" };

  it("formats calendar.generate detail", () => {
    const detail = fmtDetail(meta, "calendar.generate");
    expect(detail).toContain("6/2026");
    expect(detail).toContain("sucursal");
  });

  it("formats calendar.save detail", () => {
    const detail = fmtDetail(meta, "calendar.save");
    expect(detail).toContain("6/2026");
  });

  it("formats calendar.delete detail", () => {
    const detail = fmtDetail(meta, "calendar.delete");
    expect(detail).toContain("6/2026");
  });

  it("formats calendar.validation_blocked with error count", () => {
    const detail = fmtDetail(
      { year: 2026, month: 6, scopeType: "branch", validationSummary: { errorCount: 3, warningCount: 1 } },
      "calendar.validation_blocked",
    );
    expect(detail).toContain("3 errores");
  });
});
