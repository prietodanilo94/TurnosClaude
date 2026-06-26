import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseRotationJson, parseWeeklyHoursJson, ShiftPatternBodySchema } from "@/lib/db/schemas";

export async function GET() {
  const [dbPatterns, usageCounts] = await Promise.all([
    prisma.shiftPattern.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.branchTeam.groupBy({
      by: ["categoria"],
      _count: { categoria: true },
      where: { categoria: { not: null } },
    }),
  ]);
  const countMap = new Map(usageCounts.map((r) => [r.categoria, r._count.categoria]));

  const patterns = dbPatterns.map((p) => ({
    id: p.id,
    label: p.label,
    areaNegocio: p.areaNegocio,
    rotationWeeks: parseRotationJson(p.rotationJson),
    weeklyHours: parseWeeklyHoursJson(p.weeklyHoursJson),
    usageCount: countMap.get(p.id) ?? 0,
    createdAt: p.createdAt,
  }));

  return NextResponse.json({ patterns });
}

export async function POST(req: NextRequest) {
  const parsed = ShiftPatternBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", detail: parsed.error.message }, { status: 400 });
  }
  const { label, areaNegocio, rotationWeeks, weeklyHours } = parsed.data;

  const pattern = await prisma.shiftPattern.create({
    data: {
      label: label.trim(),
      areaNegocio,
      rotationJson:    JSON.stringify(rotationWeeks),
      weeklyHoursJson: JSON.stringify(weeklyHours),
    },
  });

  return NextResponse.json({ ok: true, id: pattern.id });
}
