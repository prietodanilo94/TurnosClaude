import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";

export async function POST(req: NextRequest) {
  const { teamId, year, month, slotsData, assignments } = await req.json();

  const team = await prisma.branchTeam.findUnique({
    where: { id: teamId },
    select: { branchId: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  const existing = await prisma.calendar.findUnique({
    where: { branchTeamId_year_month: { branchTeamId: teamId, year, month } },
  });

  const calendar = await prisma.calendar.upsert({
    where: { branchTeamId_year_month: { branchTeamId: teamId, year, month } },
    create: {
      branchTeamId: teamId,
      year,
      month,
      slotsData: JSON.stringify(slotsData),
      assignments: JSON.stringify(assignments),
    },
    update: {
      slotsData: JSON.stringify(slotsData),
      assignments: JSON.stringify(assignments),
    },
  });

  await logAction({
    action: "calendar.generate",
    entityType: "calendar",
    entityId: calendar.id,
    branchId: team.branchId,
    metadata: {
      teamId,
      year,
      month,
      slotCount: Array.isArray(slotsData) ? slotsData.length : 0,
      assignedCount: Object.values(assignments ?? {}).filter(Boolean).length,
      mode: existing ? "update" : "create",
    },
    req,
  });

  return NextResponse.json({ id: calendar.id });
}

export async function PUT(req: NextRequest) {
  const { id, slotsData, assignments } = await req.json();

  const current = await prisma.calendar.findUnique({
    where: { id },
    include: { branchTeam: { select: { branchId: true } } },
  });
  if (!current) {
    return NextResponse.json({ error: "Calendario no encontrado" }, { status: 404 });
  }

  const calendar = await prisma.calendar.update({
    where: { id },
    data: {
      slotsData: JSON.stringify(slotsData),
      assignments: JSON.stringify(assignments),
    },
  });

  await logAction({
    action: "calendar.assign",
    entityType: "calendar",
    entityId: calendar.id,
    branchId: current.branchTeam.branchId,
    metadata: {
      teamId: current.branchTeamId,
      year: current.year,
      month: current.month,
      assignedCount: Object.values(assignments ?? {}).filter(Boolean).length,
    },
    req,
  });

  return NextResponse.json({ id: calendar.id });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const calendar = await prisma.calendar.findUnique({
    where: { id },
    include: { branchTeam: { select: { branchId: true } } },
  });
  if (!calendar) {
    return NextResponse.json({ error: "Calendario no encontrado" }, { status: 404 });
  }

  await prisma.calendar.delete({ where: { id } });

  await logAction({
    action: "calendar.delete",
    entityType: "calendar",
    entityId: id,
    branchId: calendar.branchTeam.branchId,
    metadata: {
      teamId: calendar.branchTeamId,
      year: calendar.year,
      month: calendar.month,
    },
    req,
  });

  return NextResponse.json({ ok: true });
}
