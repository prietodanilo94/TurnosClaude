import { prisma } from "@/lib/db/prisma";
import { getAllPatterns } from "@/lib/patterns/catalog";
import CategoriasClient from "./CategoriasClient";
import type { WeekPattern } from "@/types";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const dbPatterns = await prisma.shiftPattern.findMany({ orderBy: { createdAt: "asc" } });

  const usageCounts = await prisma.branchTeam.groupBy({
    by: ["categoria"],
    _count: { categoria: true },
    where: { categoria: { not: null } },
  });
  const countMap = new Map(usageCounts.map((r) => [r.categoria, r._count.categoria]));

  // Usage detail: which branches use each custom pattern
  const usageDetail = await prisma.branchTeam.findMany({
    where: { categoria: { in: dbPatterns.map((p) => p.id) } },
    select: { categoria: true, branch: { select: { nombre: true } } },
  });
  const detailMap: Record<string, string[]> = {};
  for (const t of usageDetail) {
    if (!t.categoria) continue;
    detailMap[t.categoria] = [...(detailMap[t.categoria] ?? []), t.branch.nombre];
  }

  const builtIns = getAllPatterns().map((p) => ({
    id: p.id,
    label: p.label,
    areaNegocio: p.areaNegocio as "ventas" | "postventa",
    rotationWeeks: p.rotationWeeks as WeekPattern[],
    weeklyHours: p.weeklyHours,
    usageCount: countMap.get(p.id) ?? 0,
  }));

  const custom = dbPatterns.map((p) => ({
    id: p.id,
    label: p.label,
    areaNegocio: p.areaNegocio as "ventas" | "postventa",
    rotationWeeks: JSON.parse(p.rotationJson) as WeekPattern[],
    weeklyHours: JSON.parse(p.weeklyHoursJson) as number[],
    usageCount: countMap.get(p.id) ?? 0,
    usedBy: detailMap[p.id] ?? [],
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Categorías de horario</h1>
      <p className="text-sm text-gray-500 mb-6">
        Las categorías definen el patrón de rotación semanal de turnos. Cada sucursal tiene una categoría asignada.
      </p>
      <CategoriasClient builtIns={builtIns} custom={custom} />
    </div>
  );
}
