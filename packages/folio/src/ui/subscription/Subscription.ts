import { useEffect, useState } from "react";

export type FolioJsonSubscriptionStatus = "snapshot" | "fresh" | "stale";

export interface FolioJsonSubscriptionOptions<T> {
  /** Public JSON endpoint. CORS must be allowed by its publisher. */
  url: string;
  /** Server-rendered, deterministic fallback; no browser fetch is required for SSR. */
  initialData: T;
  /** Consumer-owned, strict trust-boundary validation for the publisher's schema. */
  validate: (value: unknown) => value is T;
  /** Poll only while mounted; 60s floor to avoid accidental request storms. */
  refreshMs?: number;
  timeoutMs?: number;
  enabled?: boolean;
}

export interface FolioJsonSubscriptionResult<T> {
  data: T;
  status: FolioJsonSubscriptionStatus;
  /** True only after a verified fetch since this mount. */
  refreshed: boolean;
}

/**
 * Small stale-while-revalidate client for a public, versioned JSON feed.
 *
 * The publisher remains authoritative. The initial snapshot provides static
 * HTML and no-JS support. Browsers validate every response before replacing it.
 * HTTP's own ETag/Cache-Control machinery handles network caching; this hook
 * does not invent another persistent cache or subscription backend.
 */
export function useFolioJsonSubscription<T>({
  url,
  initialData,
  validate,
  refreshMs = 300_000,
  timeoutMs = 8_000,
  enabled = true,
}: FolioJsonSubscriptionOptions<T>): FolioJsonSubscriptionResult<T> {
  const [state, setState] = useState<FolioJsonSubscriptionResult<T>>({
    data: initialData,
    status: "snapshot",
    refreshed: false,
  });

  useEffect(() => {
    if (!enabled) return;
    if (!/^https:\/\//i.test(url) && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(url)) {
      setState((current) => ({ ...current, status: "stale" }));
      return;
    }

    let active = true;
    let pending = false;
    let controller: AbortController | undefined;
    const interval = Math.max(60_000, refreshMs);
    const timeout = Math.max(1_000, timeoutMs);

    async function update() {
      if (pending) return;
      pending = true;
      const current = new AbortController();
      controller = current;
      const watchdog = setTimeout(() => current.abort(), timeout);
      try {
        const response = await fetch(url, { signal: current.signal, cache: "no-cache" });
        if (!response.ok) throw new Error("Subscription request failed: " + response.status);
        const candidate: unknown = await response.json();
        if (!validate(candidate)) throw new Error("Subscription response failed schema validation");
        if (active) setState({ data: candidate, status: "fresh", refreshed: true });
      } catch {
        // Do not replace a validated prior response with invalid/failed data.
        if (active) setState((previous) => ({ ...previous, status: "stale" }));
      } finally {
        clearTimeout(watchdog);
        pending = false;
        if (controller === current) controller = undefined;
      }
    }

    void update();
    const timer = setInterval(() => void update(), interval);
    return () => {
      active = false;
      clearInterval(timer);
      controller?.abort();
    };
  }, [enabled, url, validate, refreshMs, timeoutMs]);

  return state;
}
