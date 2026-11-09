// Public `@uichat-mira/folio/pwa/react` entry: the optional React update UI.
//
// The Service Worker lifecycle stays with the official upstream
// `virtual:pwa-register/react` hook. This module only adds the two things a
// consumer would otherwise re-implement in every Folio site:
//
//   1. a throttled "check for a new deployment" trigger on app start and on
//      foreground resume, and
//   2. an accessible default prompt that never reloads the page on its own.
//
// No design-system contract is introduced: the components use inline styles and
// Folio's existing public CSS custom properties with fallbacks, so they do not
// depend on the FOL-033/FOL-034 token or theme API and cannot leak global CSS.
//
// This module intentionally imports `react` only through the upstream hook, so
// it stays a UI-layer module and is never pulled into the core/build graph.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS,
  shouldCheckFolioPwaUpdate,
} from "./core/pwa-update";

/** Options shared by the hook and the default prompt. */
export type FolioPwaUpdateOptions = {
  /**
   * Register the Service Worker immediately instead of waiting for `load`.
   * Defaults to true so the update prompt works on the first visit.
   */
  immediate?: boolean;
  /**
   * Minimum interval between foreground-resume update checks, in milliseconds.
   * Defaults to one minute; an explicit `0` disables throttling (not
   * recommended: it turns every focus into a network request).
   */
  checkIntervalMs?: number;
  /** Called when the browser registered a worker (useful for diagnostics). */
  onRegisteredSW?: (
    swScriptUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void;
  /**
   * Called when registration failed. Registration errors are surfaced instead of
   * being swallowed; the site keeps working without offline support.
   */
  onRegisterError?: (error: unknown) => void;
};

export type FolioPwaUpdateState = {
  /** True when a new deployment is waiting for confirmation. */
  needRefresh: boolean;
  /** True when the current deployment finished precaching for offline use. */
  offlineReady: boolean;
  /** Activates the waiting worker and reloads the page. */
  confirmUpdate: () => Promise<void>;
  /** Hides the prompt without activating the waiting worker. */
  dismissUpdate: () => void;
  /** Re-check the worker immediately, bypassing the throttle. */
  checkForUpdate: () => Promise<void>;
};

function pwaNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Official `virtual:pwa-register/react` hook plus Folio's throttled
 * start/foreground update check and dismiss/confirm state.
 *
 * The lifecycle itself (installed/waiting/controlling, skipWaiting messaging,
 * reload) is owned by the upstream client. Folio only decides *when* to ask the
 * browser for a new worker and how to present the decision to the reader.
 */
export function useFolioPwaUpdate(
  options: FolioPwaUpdateOptions = {},
): FolioPwaUpdateState {
  const {
    immediate = true,
    checkIntervalMs = FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS,
    onRegisteredSW,
    onRegisterError,
  } = options;

  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const lastCheckedAtRef = useRef<number | null>(null);

  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    immediate,
    onRegisteredSW: (swScriptUrl, registration) => {
      registrationRef.current = registration;
      onRegisteredSW?.(swScriptUrl, registration);
    },
    onRegisterError: (error) => {
      // Surfaced to the consumer, never swallowed: a failed registration is
      // observable while the site itself keeps working.
      onRegisterError?.(error);
    },
  });

  const [dismissed, setDismissed] = useState(false);

  // A new deployment must re-open the prompt even if the reader dismissed the
  // previous one: dismissing is per-update, not permanent.
  useEffect(() => {
    if (needRefresh[0]) setDismissed(false);
  }, [needRefresh]);

  const checkForUpdate = useCallback(async () => {
    lastCheckedAtRef.current = pwaNow();
    const registration = registrationRef.current;
    if (!registration) return;
    try {
      await registration.update();
    } catch (error) {
      onRegisterError?.(error);
    }
  }, [onRegisterError]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const maybeCheck = () => {
      if (
        document.visibilityState === "visible" &&
        shouldCheckFolioPwaUpdate(lastCheckedAtRef.current, pwaNow(), checkIntervalMs)
      ) {
        void checkForUpdate();
      }
    };
    // The first check happens on mount (app start); resume checks are throttled.
    maybeCheck();
    document.addEventListener("visibilitychange", maybeCheck);
    window.addEventListener("focus", maybeCheck);
    return () => {
      document.removeEventListener("visibilitychange", maybeCheck);
      window.removeEventListener("focus", maybeCheck);
    };
  }, [checkForUpdate, checkIntervalMs]);

  const confirmUpdate = useCallback(async () => {
    setDismissed(false);
    await updateServiceWorker(true);
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
    needRefresh[1](false);
  }, [needRefresh]);

  return {
    needRefresh: needRefresh[0] && !dismissed,
    offlineReady: offlineReady[0],
    confirmUpdate,
    dismissUpdate,
    checkForUpdate,
  };
}

export type FolioPwaUpdatePromptProps = FolioPwaUpdateOptions & {
  /** Prompt headline. Defaults to a Chinese/English-neutral short sentence. */
  message?: string;
  /** Confirm button label. */
  confirmLabel?: string;
  /** Dismiss button label. */
  dismissLabel?: string;
  /** `role="status"` politeness. Use "assertive" only for urgent deployments. */
  politeness?: "polite" | "assertive";
  /** Replaces the built-in prompt entirely when provided. */
  render?: (state: FolioPwaUpdateState) => ReactNode;
};

const PROMPT_STYLE: Record<string, string | number> = {
  position: "fixed",
  insetInline: "auto",
  insetBlockEnd: "16px",
  insetInlineEnd: "16px",
  insetInlineStart: "auto",
  zIndex: 2147483000,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  maxWidth: "min(420px, calc(100vw - 32px))",
  padding: "12px 14px",
  borderRadius: "var(--folio-radius-md, 8px)",
  border: "1px solid var(--folio-hairline, #e6dfd8)",
  background: "var(--folio-surface-card, #efe9de)",
  color: "var(--folio-ink, #141413)",
  font: "inherit",
  fontSize: "14px",
  boxShadow: "0 8px 24px rgb(0 0 0 / 18%)",
};

const BUTTON_STYLE: Record<string, string | number> = {
  minHeight: "40px",
  padding: "0 14px",
  borderRadius: "var(--folio-radius-md, 8px)",
  border: "1px solid var(--folio-hairline, #e6dfd8)",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
};

const PRIMARY_BUTTON_STYLE: Record<string, string | number> = {
  ...BUTTON_STYLE,
  border: "1px solid var(--folio-primary, #cc785c)",
  background: "var(--folio-primary, #cc785c)",
  color: "var(--folio-on-primary, #ffffff)",
};

/**
 * Accessible default "a new version is available" prompt.
 *
 * Nothing reloads without the reader confirming it. Rendering is self-contained
 * (inline styles, no global class names, Folio tokens with literal fallbacks), so
 * it does not depend on the pending design-system cards and cannot affect the
 * rest of the page.
 */
export function FolioPwaUpdatePrompt({
  message = "本站有新版本可用。",
  confirmLabel = "刷新并更新",
  dismissLabel = "稍后",
  politeness = "polite",
  render,
  ...updateOptions
}: FolioPwaUpdatePromptProps): ReactElement | null {
  const state = useFolioPwaUpdate(updateOptions);
  if (render) return <>{render(state)}</>;
  if (!state.needRefresh) return null;

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      data-folio-pwa-update-prompt=""
      style={PROMPT_STYLE}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => void state.dismissUpdate()}
        style={BUTTON_STYLE}
        data-folio-pwa-update-dismiss=""
      >
        {dismissLabel}
      </button>
      <button
        type="button"
        onClick={() => void state.confirmUpdate()}
        style={PRIMARY_BUTTON_STYLE}
        data-folio-pwa-update-confirm=""
      >
        {confirmLabel}
      </button>
    </div>
  );
}
