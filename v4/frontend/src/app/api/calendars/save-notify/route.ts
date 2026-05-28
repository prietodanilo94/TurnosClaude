import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { generateGroupCalendarExcel } from "@/lib/excel/calendarExport";
import { logAction } from "@/lib/audit/log";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Sin acceso" }, { status: 401 });

  const { teamIds, year, month, scopeLabel, scopeType } = await req.json();

  if (!Array.isArray(teamIds) || teamIds.length === 0 || !year || !month) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  // Resolves branchId and teamId for calendar URL (uses first team)
  const firstTeam = await prisma.branchTeam.findUnique({
    where: { id: teamIds[0] },
    select: { branchId: true },
  });

  try {
    const { buffer, fileName } = await generateGroupCalendarExcel({ teamIds, year, month, scopeLabel });

    await logAction({
      action: "calendar.save",
      entityType: "calendar",
      entityId: null,
      branchId: firstTeam?.branchId ?? null,
      metadata: {
        teamId: teamIds[0],
        teamIds,
        year,
        month,
        scopeLabel: scopeLabel ?? null,
        scopeType: scopeType ?? "branch",
      },
      req,
      webhookExtras: {
        fileBase64: buffer.toString("base64"),
        fileName,
      },
    });
  } catch (err) {
    console.error("Error generando Excel para webhook:", err);
  }

  return NextResponse.json({ ok: true });
}
