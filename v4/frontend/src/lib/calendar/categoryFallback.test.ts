import { describe, expect, it } from "vitest";
import { resolveCalendarDisplayCategory, type CalendarCategoryTeam } from "./categoryFallback";

function team(overrides: Partial<CalendarCategoryTeam>): CalendarCategoryTeam {
  return {
    id: "team-a",
    areaNegocio: "ventas",
    categoria: null,
    branch: { groupId: "group-1", nombre: "Sucursal A" },
    ...overrides,
  };
}

describe("resolveCalendarDisplayCategory", () => {
  it("uses the team's own category when available", () => {
    const result = resolveCalendarDisplayCategory(
      team({ categoria: "ventas_mall_7d" }),
      [team({ id: "team-b", categoria: "ventas_standalone", branch: { groupId: "group-1", nombre: "Sucursal B" } })],
    );

    expect(result).toEqual({ categoria: "ventas_mall_7d", source: "own" });
  });

  it("falls back to a same-area category from the branch group", () => {
    const result = resolveCalendarDisplayCategory(
      team({ id: "team-nissan", categoria: null, branch: { groupId: "group-1", nombre: "Nissan" } }),
      [
        team({
          id: "team-citroen",
          categoria: "ventas_mall_7d",
          branch: { groupId: "group-1", nombre: "Citroen" },
        }),
      ],
    );

    expect(result).toEqual({
      categoria: "ventas_mall_7d",
      source: "group",
      sourceBranchName: "Citroen",
    });
  });

  it("does not borrow categories from another area or group", () => {
    const result = resolveCalendarDisplayCategory(
      team({ id: "team-nissan", categoria: null, branch: { groupId: "group-1", nombre: "Nissan" } }),
      [
        team({
          id: "team-other-area",
          areaNegocio: "postventa",
          categoria: "postventa_6d",
          branch: { groupId: "group-1", nombre: "Postventa" },
        }),
        team({
          id: "team-other-group",
          categoria: "ventas_mall_7d",
          branch: { groupId: "group-2", nombre: "Otro grupo" },
        }),
      ],
    );

    expect(result).toEqual({ categoria: null, source: "missing" });
  });
});
