export function fmtDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function dateRangeInclusive(start: string, end: string): string[] {
  const result: string[] = [];
  const cursor = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  while (cursor <= endDate) {
    result.push(fmtDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function clampDateOnly(value: Date): Date {
  return parseDateOnly(fmtDateOnly(value));
}
