export interface CalendarCategoryTeam {
  id: string;
  areaNegocio: string;
  categoria: string | null;
  branch: {
    groupId: string | null;
    nombre?: string;
  };
}

export interface CalendarCategoryResolution {
  categoria: string | null;
  source: "own" | "group" | "missing";
  sourceBranchName?: string;
}

export function resolveCalendarDisplayCategory(
  team: CalendarCategoryTeam,
  groupCandidates: CalendarCategoryTeam[],
): CalendarCategoryResolution {
  if (team.categoria) {
    return { categoria: team.categoria, source: "own" };
  }

  if (!team.branch.groupId) {
    return { categoria: null, source: "missing" };
  }

  const fallback = groupCandidates.find((candidate) =>
    candidate.id !== team.id &&
    candidate.areaNegocio === team.areaNegocio &&
    candidate.branch.groupId === team.branch.groupId &&
    !!candidate.categoria
  );

  if (!fallback?.categoria) {
    return { categoria: null, source: "missing" };
  }

  return {
    categoria: fallback.categoria,
    source: "group",
    sourceBranchName: fallback.branch.nombre,
  };
}
