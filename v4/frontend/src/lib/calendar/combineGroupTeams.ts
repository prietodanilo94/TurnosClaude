import { generateCalendar } from "./generator";
import { ensureRotationAnchors } from "./rotationAnchor";
import type { CalendarSlot, ShiftPatternDef } from "@/types";
import type { TeamSlice } from "./teamSplit";

export interface CombinableTeam {
  id: string;
  workers: { id: string; nombre: string; rotationAnchor: number | null }[];
  calendar: { slotsData: string; assignments: string } | null; // ya filtrado al mes objetivo
}

export interface CombinedTeamsResult {
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
  workers: { id: string; nombre: string }[];
  slices: TeamSlice[];
  hasCalendar: boolean;
}

/**
 * Combina varios equipos (de distintas sucursales de un mismo grupo, misma
 * area) en una sola tabla de slots/assignments — la misma logica que usa la
 * vista en pantalla del supervisor (SupervisorCalendarView), para que
 * cualquier otro consumidor (ej. export a Excel) muestre exactamente lo
 * mismo que se ve combinado en pantalla, en un solo bloque.
 *
 * El offset del siguiente equipo avanza segun la cantidad real de slots
 * agregados (teamSlots.length), no la cantidad de trabajadores activos hoy —
 * si se usa N ahi, un equipo con menos activos que slots guardados (alguien
 * desactivado sin regenerar) produce numeros de slot que chocan con el
 * equipo siguiente. Ver F8 (fix offset de grupo).
 */
export async function combineGroupTeams(
  teams: CombinableTeam[],
  year: number,
  month: number,
  definedCat: string | null,
  patternOverride: ShiftPatternDef | undefined,
): Promise<CombinedTeamsResult> {
  let offset = 0;
  const allSlots: CalendarSlot[] = [];
  const allAssignments: Record<string, string | null> = {};
  const allWorkers: { id: string; nombre: string }[] = [];
  const slices: TeamSlice[] = [];
  let hasCalendar = false;

  for (const team of teams) {
    const N = team.workers.length;
    const anchors = await ensureRotationAnchors(
      team.workers.map((w) => ({ id: w.id, rotationAnchor: w.rotationAnchor })),
    );
    const slotAnchors = anchors.map((a) => a.rotationAnchor);

    let teamSlots: CalendarSlot[];
    let teamAssign: Record<string, string | null>;

    if (team.calendar) {
      hasCalendar = true;
      teamSlots = JSON.parse(team.calendar.slotsData) as CalendarSlot[];
      teamAssign = JSON.parse(team.calendar.assignments) as Record<string, string | null>;
      // Auto-agregar slots para trabajadores nuevos
      if (N > teamSlots.length && definedCat) {
        const full = generateCalendar(definedCat, year, month, slotAnchors, patternOverride);
        teamSlots = [...teamSlots, ...full.slots.slice(teamSlots.length)];
      }
    } else if (definedCat) {
      teamSlots = generateCalendar(definedCat, year, month, slotAnchors, patternOverride).slots;
      teamAssign = {};
    } else {
      teamSlots = [];
      teamAssign = {};
    }

    allSlots.push(...teamSlots.map((s) => ({ ...s, slotNumber: s.slotNumber + offset })));
    for (const [k, v] of Object.entries(teamAssign)) allAssignments[String(Number(k) + offset)] = v;
    allWorkers.push(...team.workers.map((w) => ({ id: w.id, nombre: w.nombre })));
    slices.push({
      teamId: team.id,
      workerIds: team.workers.map((w) => w.id),
      slotCount: teamSlots.length,
      rotationAnchors: slotAnchors,
    });
    offset += teamSlots.length;
  }

  return { slots: allSlots, assignments: allAssignments, workers: allWorkers, slices, hasCalendar };
}
