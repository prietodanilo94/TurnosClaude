import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";

export async function POST(req: NextRequest) {
  const { teamId, year, month, scopeLabel, scopeType, outcome, validationSummary } = await req.json();

  if (!teamId || !year || !month) {
    return NextResponse.json({ error: "Faltan datos del calendario" }, { status: 400 });
  }

  const team = await prisma.branchTeam.findUnique({
    where: { id: teamId },
    select: { branchId: true },
  });

  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  await logAction({
    action: "calendar.validation_blocked",
    entityType: "calendar",
    entityId: null,
    branchId: team.branchId,
    metadata: {
      teamId,
      year,
      month,
      scopeLabel: scopeLabel ?? null,
      scopeType: scopeType ?? "branch",
      outcome: outcome ?? "unknown",
      validationSummary: validationSummary ?? null,
    },
    req,
  });

  return NextResponse.json({ ok: true });
}
