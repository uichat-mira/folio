// Update-check policy for the optional Folio PWA integration (FOL-039).
//
// This module is Core: it owns one pure decision ("is it time to ask the
// browser to re-check the service worker?") and nothing else. The React hook in
// src/pwa-react.tsx supplies the timestamps and performs the actual
// `registration.update()` call; the service-worker lifecycle itself stays with
// the upstream `virtual:pwa-register/react` client so Folio never maintains a
// second update state machine.

/**
 * Default minimum interval between resume/visibility update checks.
 *
 * A publishing site is not a chat app: re-checking the service worker on every
 * tab focus would cost a network round trip per focus for readers who keep the
 * page open all day. One minute is short enough to pick up a deployment during
 * a reading session and long enough that repeated switching cannot spin.
 */
export const FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS = 60_000;

/**
 * Whether a throttled update check is allowed at `now`.
 *
 * A missing or non-finite previous timestamp means the hook has not checked
 * yet, so the first resume is always allowed. An invalid interval is a
 * programming error and fails loudly instead of silently disabling checks.
 */
export function shouldCheckFolioPwaUpdate(
  lastCheckedAt: number | null | undefined,
  now: number,
  intervalMs: number = FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS,
): boolean {
  if (typeof intervalMs !== "number" || !Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new Error(
      `folio PWA update interval must be a finite non-negative number, got ${JSON.stringify(intervalMs)}`,
    );
  }
  if (lastCheckedAt === null || lastCheckedAt === undefined) return true;
  if (!Number.isFinite(lastCheckedAt)) return true;
  return now - lastCheckedAt >= intervalMs;
}
