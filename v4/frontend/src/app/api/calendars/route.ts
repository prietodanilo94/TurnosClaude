import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log";
import { diffSpilloverChanges, extractNextMonthSpillover, overlayDaysByWorker } from "@/lib/calendar/spillover";
import type { CalendarSlot } from "@/types";

// Decision del usuario (2026-07-10): los dias remanentes de la ultima
// semana son reales — se propagan hacia el mes siguiente al guardar, y un
// mes recien creado hereda el remanente que su antecesor ya decidio.
//
// Solo se propaga lo que CAMBIO en este guardado (diffSpilloverChanges), no
// todo el remanente extraido de la grilla actual: si no, cualquier edicion
// del mes — aunque sea en un dia sin relacion — vuelve a pisar el mes
// siguiente con la copia local (posiblemente vieja) del remanente, borrando
// datos reales que ya divergieron alla (bug real, reportado 2026-07-13).
async function propagateSpilloverForward(
  branchTeamId: string,
  year: number,
  month: number,
  oldSlots: CalendarSlot[] | null,
  oldAssignments: Record<string, string | null> | null,
  newSlots: CalendarSlot[],
  newAssignments: Record<string, string | null>,
) {
  const changed = diffSpilloverChanges(oldSlots, oldAssignments, newSlots, newAssignments, year, month);
  if (changed.length === 0) return;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextCal = await prisma.calendar.findUnique({
    where: { branchTeamId_year_month: { branchTeamId, year: nextYear, month: nextMonth } },
  });
  if (!nextCal) return; // el vecino aun no existe: heredara al crearse
  try {
    const nSlots: CalendarSlot[] = JSON.parse(nextCal.slotsData);
    const nAsg: Record<string, string | null> = JSON.parse(nextCal.assignments);
    const { slots: merged, changed: didChange } = overlayDaysByWorker(nSlots, nAsg, changed);
    if (didChange) {
      await prisma.calendar.update({ where: { id: nextCal.id }, data: { slotsData: JSON.stringify(merged) } });
    }
  } catch {
    // slotsData ilegible en el vecino: no propagar antes que corromper
  }
}

// Al crear un mes: sembrar sus primeros dias desde el remanente REAL que el
// mes anterior ya tiene guardado (esa semana ya fue planificada alla).
async function seedFromPreviousMonth(
  branchTeamId: string,
  year: number,
  month: number,
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
): Promise<CalendarSlot[]> {
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevCal = await prisma.calendar.findUnique({
    where: { branchTeamId_year_month: { branchTeamId, year: prevYear, month: prevMonth } },
  });
  if (!prevCal) return slots;
  try {
    const pSlots: CalendarSlot[] = JSON.parse(prevCal.slotsData);
    const pAsg: Record<string, string | null> = JSON.parse(prevCal.assignments);
    const spill = extractNextMonthSpillover(pSlots, pAsg, prevYear, prevMonth);
    if (spill.length === 0) return slots;
    return overlayDaysByWorker(slots, assignments, spill).slots;
  } catch {
    return slots;
  }
}

export async function POST(req: NextRequest) {
  const { teamId, year, month, slotsData, assignments, validationSummary, scopeLabel, scopeType, origen } = await req.json();

  // origen: "libre" (editor de horario libre, F11) o null/ausente (rotativo).
  // El ultimo guardado define el tipo oficial del mes — guardar rotativo
  // sobre un calendario libre lo vuelve rotativo, y viceversa (la UI
  // advierte antes de cambiar de tipo).
  const origenValue = origen === "libre" ? "libre" : null;

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

  const assignedCount = Object.values(assignments ?? {}).filter(Boolean).length;

  let oldSlots: CalendarSlot[] | null = null;
  let oldAssignments: Record<string, string | null> | null = null;
  if (existing) {
    try {
      oldSlots = JSON.parse(existing.slotsData);
      oldAssignments = JSON.parse(existing.assignments);
    } catch {
      oldSlots = null;
      oldAssignments = null;
    }
  }

  // Mes nuevo: heredar como reales los dias que el mes anterior ya decidio
  // para la semana compartida.
  const finalSlots: CalendarSlot[] = existing
    ? slotsData
    : await seedFromPreviousMonth(teamId, year, month, slotsData, assignments ?? {});

  const calendar = await prisma.calendar.upsert({
    where: { branchTeamId_year_month: { branchTeamId: teamId, year, month } },
    create: {
      branchTeamId: teamId,
      year,
      month,
      slotsData: JSON.stringify(finalSlots),
      assignments: JSON.stringify(assignments),
      assignedCount,
      origen: origenValue,
    },
    update: {
      slotsData: JSON.stringify(finalSlots),
      assignments: JSON.stringify(assignments),
      assignedCount,
      origen: origenValue,
    },
  });

  // Propagar el remanente hacia el mes siguiente si ya existe.
  await propagateSpilloverForward(teamId, year, month, oldSlots, oldAssignments, finalSlots, assignments ?? {});

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
      validationSummary: validationSummary ?? null,
      scopeLabel: scopeLabel ?? null,
      scopeType: scopeType ?? "branch",
      mode: existing ? "update" : "create",
      origen: origenValue,
    },
    req,
  });

  return NextResponse.json({ id: calendar.id });
}

export async function PUT(req: NextRequest) {
  const { id, slotsData, assignments, validationSummary, scopeLabel, scopeType } = await req.json();

  const current = await prisma.calendar.findUnique({
    where: { id },
    include: { branchTeam: { select: { branchId: true } } },
  });
  if (!current) {
    return NextResponse.json({ error: "Calendario no encontrado" }, { status: 404 });
  }

  let oldSlots: CalendarSlot[] | null = null;
  let oldAssignments: Record<string, string | null> | null = null;
  try {
    oldSlots = JSON.parse(current.slotsData);
    oldAssignments = JSON.parse(current.assignments);
  } catch {
    oldSlots = null;
    oldAssignments = null;
  }

  const calendar = await prisma.calendar.update({
    where: { id },
    data: {
      slotsData: JSON.stringify(slotsData),
      assignments: JSON.stringify(assignments),
      assignedCount: Object.values(assignments ?? {}).filter(Boolean).length,
    },
  });

  await propagateSpilloverForward(current.branchTeamId, current.year, current.month, oldSlots, oldAssignments, slotsData, assignments ?? {});

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
      validationSummary: validationSummary ?? null,
      scopeLabel: scopeLabel ?? null,
      scopeType: scopeType ?? "branch",
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
