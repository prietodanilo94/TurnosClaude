import { prisma } from "@/lib/db/prisma";
import CategoriasClient from "./CategoriasClient";
import type { WeekPattern } from "@/types";
import { parseRotationJson, parseWeeklyHoursJson } from "@/lib/db/schemas";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const [dbPatterns, usageCounts, usageDetail] = await Promise.all([
    prisma.shiftPattern.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.branchTeam.groupBy({
      by: ["categoria"],
      _count: { categoria: true },
      where: { categoria: { not: null } },
    }),
    prisma.branchTeam.findMany({
      where: { categoria: { not: null } },
      select: { categoria: true, branch: { select: { nombre: true } } },
    }),
  ]);

  const countMap = new Map(usageCounts.map((r) => [r.categoria, r._count.categoria]));
  const detailMap: Record<string, string[]> = {};
  for (const t of usageDetail) {
    if (!t.categoria) continue;
    detailMap[t.categoria] = [...(detailMap[t.categoria] ?? []), t.branch.nombre];
  }

  const items = dbPatterns.map((p) => ({
    id: p.id,
    label: p.label,
    areaNegocio: p.areaNegocio as "ventas" | "postventa",
    rotationWeeks: parseRotationJson(p.rotationJson),
    weeklyHours: parseWeeklyHoursJson(p.weeklyHoursJson),
    usageCount: countMap.get(p.id) ?? 0,
    usedBy: detailMap[p.id] ?? [],
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Categorías de horario</h1>
      <p className="text-sm text-gray-500 mb-6">
        Las categorías definen el patrón de rotación semanal de turnos. Cada sucursal tiene una categoría asignada.
      </p>
      <CategoriasClient items={items} />
    </div>
  );
}
