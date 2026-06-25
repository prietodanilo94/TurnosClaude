import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { WeekPattern } from "@/types";
import { parseRotationJson, parseWeeklyHoursJson } from "@/lib/db/schemas";

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
  const body = await req.json() as {
    label: string;
    areaNegocio: string;
    rotationWeeks: WeekPattern[];
    weeklyHours: number[];
  };

  if (!body.label?.trim() || !body.areaNegocio || !body.rotationWeeks?.length) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const pattern = await prisma.shiftPattern.create({
    data: {
      label: body.label.trim(),
      areaNegocio: body.areaNegocio,
      rotationJson: JSON.stringify(body.rotationWeeks),
      weeklyHoursJson: JSON.stringify(body.weeklyHours),
    },
  });

  return NextResponse.json({ ok: true, id: pattern.id });
}
