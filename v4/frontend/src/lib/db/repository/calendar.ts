import { prisma } from "@/lib/db/prisma";
import { parseSlotsData, parseAssignments } from "@/lib/db/schemas";
import type { CalendarSlot } from "@/types";

/**
 * Obtiene un calendario con slots y assignments ya parseados.
 * Retorna null si no existe.
 */
export async function getCalendar(branchTeamId: string, year: number, month: number): Promise<{
  id: string;
  branchTeamId: string;
  year: number;
  month: number;
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  assignedCount: number;
  lastExportedAt: Date | null;
} | null> {
  const cal = await prisma.calendar.findUnique({
    where: { branchTeamId_year_month: { branchTeamId, year, month } },
  });

  if (!cal) return null;

  return {
    id: cal.id,
    branchTeamId: cal.branchTeamId,
    year: cal.year,
    month: cal.month,
    slots: parseSlotsData(cal.slotsData),
    assignments: parseAssignments(cal.assignments),
    assignedCount: cal.assignedCount,
    lastExportedAt: cal.lastExportedAt,
  };
}

/**
 * Calendarios de un mes para un conjunto de equipos.
 * Devuelve raw (sin parsear slotsData/assignments) para operaciones masivas
 * que prefieren parsear selectivamente.
 */
export async function getCalendarsByTeams(teamIds: string[], year: number, month: number) {
  return prisma.calendar.findMany({
    where: { branchTeamId: { in: teamIds }, year, month },
  });
}

/**
 * Calendarios adyacentes (mes anterior y siguiente) para navegación de asignaciones.
 */
export async function getAdjacentCalendars(branchTeamId: string, year: number, month: number) {
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);

  const [prevCal, nextCal] = await Promise.all([
    prisma.calendar.findUnique({
      where: { branchTeamId_year_month: {
        branchTeamId,
        year: prevDate.getFullYear(),
        month: prevDate.getMonth() + 1,
      }},
      select: { assignments: true },
    }),
    prisma.calendar.findUnique({
      where: { branchTeamId_year_month: {
        branchTeamId,
        year: nextDate.getFullYear(),
        month: nextDate.getMonth() + 1,
      }},
      select: { assignments: true },
    }),
  ]);

  return {
    prev: prevCal ? parseAssignments(prevCal.assignments) : {},
    next: nextCal ? parseAssignments(nextCal.assignments) : {},
  };
}
