function toDayNumber(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T12:00:00Z`).getTime() / 86_400_000);
}

export function getMaxConsecutiveWorkedDays(workedDates: string[]): number {
  const uniqueSorted = Array.from(new Set(workedDates)).sort();
  if (uniqueSorted.length === 0) return 0;

  let maxRun = 1;
  let currentRun = 1;

  for (let index = 1; index < uniqueSorted.length; index += 1) {
    const previous = toDayNumber(uniqueSorted[index - 1]);
    const current = toDayNumber(uniqueSorted[index]);
    if (current - previous === 1) {
      currentRun += 1;
      if (currentRun > maxRun) maxRun = currentRun;
    } else {
      currentRun = 1;
    }
  }

  return maxRun;
}

export function getConsecutiveViolationDetail(
  workedDates: string[],
  maxAllowed: number
): string | null {
  const maxRun = getMaxConsecutiveWorkedDays(workedDates);
  if (maxRun <= maxAllowed) return null;
  return `Racha maxima ${maxRun} dias > ${maxAllowed}`;
}
