// Core date parsing for Folio content. This module is pure: it only turns
// frontmatter values into the frozen cross-machine representation and never
// reads the filesystem, Git or the clock.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Normalize one explicit date value to ISO 8601 UTC.
 *
 * Accepted forms:
 * - `YYYY-MM-DD` (a calendar date, anchored to UTC midnight);
 * - an ISO 8601 date-time with an explicit `Z` or numeric offset.
 *
 * A date-time without an offset is rejected instead of being interpreted in
 * the build machine's local timezone: its instant would differ per machine and
 * would silently change the emitted metadata.
 */
export function normalizeFolioDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (DATE_ONLY.test(trimmed)) {
    // Reject impossible calendar dates (`2024-02-30`) instead of letting the
    // Date constructor silently roll them into the next month.
    const [year, month, day] = trimmed.split("-").map(Number);
    const dateOnly = new Date(Date.UTC(year, month - 1, day));
    if (
      dateOnly.getUTCFullYear() !== year ||
      dateOnly.getUTCMonth() !== month - 1 ||
      dateOnly.getUTCDate() !== day
    ) {
      return undefined;
    }
    return dateOnly.toISOString();
  }

  if (!EXPLICIT_OFFSET.test(trimmed)) return undefined;

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
