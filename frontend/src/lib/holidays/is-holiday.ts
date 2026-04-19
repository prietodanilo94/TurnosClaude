import type { Holiday } from "@/types/models";

export function isHoliday(date: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.fecha === date);
}
