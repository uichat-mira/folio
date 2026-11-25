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

/**
 * Observability of the Service Worker registration itself.
 *
 * `virtual:pwa-register/react` reports only "a worker was registered" and "that
 * failed"; it says nothing when the browser has no Service Worker support at
 * all, and a consumer cannot tell "not registered yet" from "never will be".
 * Folio derives those four states from the upstream callbacks instead of
 * running a second Service Worker state machine: the browser and the upstream
 * client still own installation, activation and control.
 */
export type FolioPwaRegistrationState =
  /** The browser has no `serviceWorker` API; nothing will ever register. */
  | "unsupported"
  /** Supported, but no registration result has arrived yet. */
  | "registering"
  /** A worker registration is active for this page. */
  | "registered"
  /** Registration failed; the site keeps working without offline support. */
  | "failed";

export type FolioPwaRegistrationInput = {
  supported: boolean;
  registered?: boolean;
  failed?: boolean;
};

/**
 * Collapse the registration callbacks into one observable state.
 *
 * A failure wins over a later success and vice versa only for the event that
 * actually happened last, which is why the caller tracks a single event instead
 * of both booleans; `supported: false` always wins, because a registration that
 * cannot happen must never be reported as pending forever.
 */
export function folioPwaRegistrationState(
  input: FolioPwaRegistrationInput,
): FolioPwaRegistrationState {
  if (!input.supported) return "unsupported";
  if (input.failed) return "failed";
  if (input.registered) return "registered";
  return "registering";
}
