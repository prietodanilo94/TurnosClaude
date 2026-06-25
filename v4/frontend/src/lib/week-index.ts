/**
 * Epoch-based week index used for calendar rotation alignment.
 *
 * Returns the number of complete 7-day periods since the Unix epoch (1970-01-01).
 * This is intentionally NOT the ISO 8601 week number (1-53) — it is epoch-based
 * to produce a monotonically increasing index that anchors rotations consistently
 * across months and years.
 *
 * ⚠️  DO NOT replace this formula with date-fns/getISOWeek or any ISO week function.
 *     ISO week 26 % 4 ≠ epoch week 2943 % 4 for the same date.
 *     Changing the formula silently shifts rotations for all future "Regenerar" calls,
 *     producing incorrect schedules for real employees.
 *
 * Why this is safe despite using epoch arithmetic:
 * - Chile moved to permanent summer time (UTC-3) in 2015 — no DST transitions occur.
 * - The Docker container inherits a fixed server timezone (America/Santiago).
 * - Epoch milliseconds on midnight dates are stable under these conditions.
 *
 * Verified anchor points (do not change without updating tests):
 * - 2026-06-01 (Monday) → week index 2943 → 2943 % 4 = 3
 * - 2026-05-04 (Monday) → week index 2939 → 2939 % 4 = 3
 *
 * @param monday - The Monday of the week to index. Must be a Monday; passing other
 *   days will produce an offset result that breaks rotation alignment.
 */
export function getWeekIndex(monday: Date): number {
  return Math.floor(monday.getTime() / (7 * 24 * 3600 * 1000));
}
