import type { CalendarSlot } from "@/types";

export interface TeamSlice {
  teamId: string;
  workerIds: string[];
  // Cantidad real de slots que ocupa este equipo en el arreglo combinado.
  // Puede diferir de workerIds.length cuando el calendario guardado tiene
  // mas o menos slots que trabajadores activos hoy (alguien fue agregado o
  // desactivado sin regenerar). Si no se especifica, se asume workerIds.length
  // (caso de generacion nueva, donde ambos siempre coinciden).
  slotCount?: number;
  // Ancla de rotacion de cada trabajador, mismo orden que workerIds. Se usa
  // al generar por primera vez desde el cliente (ver F9-rotacion-estable).
  rotationAnchors?: number[];
}

export interface SplitTeamCalendar {
  teamId: string;
  slots: CalendarSlot[];
  assignments: Record<string, string | null>;
}

export function splitCalendarByTeam(
  slots: CalendarSlot[],
  assignments: Record<string, string | null>,
  slices: TeamSlice[],
): SplitTeamCalendar[] {
  const result: SplitTeamCalendar[] = [];
  let offset = 0;

  for (const slice of slices) {
    const workerCount = slice.slotCount ?? slice.workerIds.length;
    const teamSlots = slots
      .filter((slot) => slot.slotNumber > offset && slot.slotNumber <= offset + workerCount)
      .map((slot) => ({ ...slot, slotNumber: slot.slotNumber - offset }));

    const teamAssignments: Record<string, string | null> = {};
    for (const [slotNumber, workerId] of Object.entries(assignments)) {
      const numericSlot = Number(slotNumber);
      if (numericSlot > offset && numericSlot <= offset + workerCount) {
        teamAssignments[String(numericSlot - offset)] = workerId;
      }
    }

    result.push({ teamId: slice.teamId, slots: teamSlots, assignments: teamAssignments });
    offset += workerCount;
  }

  return result;
}
