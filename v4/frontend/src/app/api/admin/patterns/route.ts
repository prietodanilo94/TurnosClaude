import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAllPatterns } from "@/lib/patterns/catalog";
import type { WeekPattern } from "@/types";

export async function GET() {
  const dbPatterns = await prisma.shiftPattern.findMany({ orderBy: { createdAt: "asc" } });
  const builtIns = getAllPatterns().map((p) => ({ ...p, builtIn: true, usageCount: 0 }));

  const usageCounts = await prisma.branchTeam.groupBy({
    by: ["categoria"],
    _count: { categoria: true },
    where: { categoria: { not: null } },
  });
  const countMap = new Map(usageCounts.map((r) => [r.categoria, r._count.categoria]));

  const builtInsWithCount = builtIns.map((p) => ({ ...p, usageCount: countMap.get(p.id) ?? 0 }));

  const custom = dbPatterns.map((p) => ({
    id: p.id,
    label: p.label,
    areaNegocio: p.areaNegocio,
    rotationWeeks: JSON.parse(p.rotationJson) as WeekPattern[],
    weeklyHours: JSON.parse(p.weeklyHoursJson) as number[],
    builtIn: false,
    usageCount: countMap.get(p.id) ?? 0,
    createdAt: p.createdAt,
  }));

  return NextResponse.json({ builtIns: builtInsWithCount, custom });
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
