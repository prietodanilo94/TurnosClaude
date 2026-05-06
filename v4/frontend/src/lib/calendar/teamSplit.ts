import type { CalendarSlot } from "@/types";

export interface TeamSlice {
  teamId: string;
  workerIds: string[];
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
    const workerCount = slice.workerIds.length;
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
