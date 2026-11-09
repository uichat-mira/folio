// Harness-facing globals set by the fixture itself.
//
// These are the only non-DOM channels between the consumer fixture and
// docs/research/fol-039/browser-prompt.mjs, and every one of them is written by
// real consumer code running in the browser (never by the harness), so an
// assertion based on them reflects the package's public behavior.
export {};

declare global {
  interface Window {
    /** `checkForUpdate` from `useFolioPwaUpdate()`, for deterministic checks. */
    __folioPwaCheck?: () => Promise<void>;
    /** True once `onRegisteredSW` reported a registration. */
    __folioPwaRegistered?: boolean;
    /** `registrationState` from `useFolioPwaUpdate()` (FOL-039 P3). */
    __folioPwaRegistrationState?: "unsupported" | "registering" | "registered" | "failed";
    /** `supported` from `useFolioPwaUpdate()`. */
    __folioPwaSupported?: boolean;
    /** `registered` convenience flag from `useFolioPwaUpdate()`. */
    __folioPwaRegisteredFlag?: boolean;
    /** Message reported through the consumer's `onRegisterError` path. */
    __folioPwaRegisterError?: string;
    /** True once the React harness rendered. */
    __folioPwaMounted?: boolean;
    /** Per-document id; a different value means the page really reloaded. */
    __folioBootId?: string;
  }
}
