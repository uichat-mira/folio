import {
  createContext, useCallback, useContext, useRef, useState,
  type ReactNode,
} from "react";

/** App-owned navigation expansion survives switching between individual readers. */
type NavigationState = {
  values: Record<string, boolean>;
  change: (key: string, expanded: boolean) => void;
  revealOnRoute: (scope: string, route: string, activeIds: readonly string[]) => void;
};

const Context = createContext<NavigationState | null>(null);

export function FolioNavigationStateProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<string, boolean>>({});
  const previousRoutes = useRef<Record<string, string>>({});

  const change = useCallback((key: string, expanded: boolean) => {
    setValues((old) => old[key] === expanded ? old : { ...old, [key]: expanded });
  }, []);

  const revealOnRoute = useCallback((scope: string, route: string, activeIds: readonly string[]) => {
    if (previousRoutes.current[scope] === route) return;
    previousRoutes.current[scope] = route;
    setValues((old) => {
      let next = old;
      for (const id of activeIds) {
        const key = scope + "::" + id;
        if (next[key] === true) continue;
        if (next === old) next = { ...old };
        next[key] = true;
      }
      return next;
    });
  }, []);

  return (
    <Context.Provider value={{ values, change, revealOnRoute }}>
      {children}
    </Context.Provider>
  );
}

export function useFolioNavigationState(): NavigationState | null {
  return useContext(Context);
}
