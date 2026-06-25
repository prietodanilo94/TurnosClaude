import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";
import type { WeekPattern } from "@/types";
import { parseRotationJson, parseWeeklyHoursJson } from "@/lib/db/schemas";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supervisorId = session.supervisorId ?? null;

  const patterns = await prisma.shiftPattern.findMany({
    where: supervisorId
      ? { OR: [{ supervisorId: null }, { supervisorId }] }
      : { supervisorId: null },
    orderBy: [{ supervisorId: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    patterns.map((p) => ({
      ...p,
      rotationWeeks: parseRotationJson(p.rotationJson),
      weeklyHours: parseWeeklyHoursJson(p.weeklyHoursJson),
      isCustom: p.supervisorId !== null,
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !session.supervisorId) {
    return NextResponse.json({ error: "Solo supervisores pueden crear horarios" }, { status: 403 });
  }

  const body = await req.json() as {
    label?: string;
    areaNegocio?: string;
    rotationWeeks?: WeekPattern[];
    weeklyHours?: number[];
  };

  const { label, areaNegocio, rotationWeeks, weeklyHours } = body;

  if (!label?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (areaNegocio !== "ventas" && areaNegocio !== "postventa") {
    return NextResponse.json({ error: "areaNegocio inválido" }, { status: 400 });
  }
  if (!Array.isArray(rotationWeeks) || rotationWeeks.length === 0) {
    return NextResponse.json({ error: "rotationWeeks requerido" }, { status: 400 });
  }
  if (!Array.isArray(weeklyHours) || weeklyHours.length !== rotationWeeks.length) {
    return NextResponse.json({ error: "weeklyHours debe tener el mismo largo que rotationWeeks" }, { status: 400 });
  }

  const pattern = await prisma.shiftPattern.create({
    data: {
      label: label.trim(),
      areaNegocio,
      rotationJson: JSON.stringify(rotationWeeks),
      weeklyHoursJson: JSON.stringify(weeklyHours),
      supervisorId: session.supervisorId,
    },
  });

  return NextResponse.json({
    ...pattern,
    rotationWeeks: parseRotationJson(pattern.rotationJson),
    weeklyHours: parseWeeklyHoursJson(pattern.weeklyHoursJson),
    isCustom: true,
  }, { status: 201 });
}
