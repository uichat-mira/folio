import { createContext, useContext } from "react";
import type { FolioResolvedAppearance } from "./core/appearance";

export type FolioAppearanceController = {
  /** Selected preset, preferred scheme (possibly system), and syntax palette. */
  appearance: FolioResolvedAppearance;
  /** The actual light/dark scheme, including OS and theme-disable resolution. */
  effectiveScheme: "light" | "dark";
  isPreviewing: boolean;
  /** Session-only changes. A partial patch keeps other selections intact. */
  preview: (changes: Partial<FolioResolvedAppearance>) => void;
  /** Restore explicit reader preference, then site configuration/OS defaults. */
  resetPreview: () => void;
};

/** Internal provider is owned by FolioApp; consumers use the public hook. */
export const FolioAppearanceContext = createContext<FolioAppearanceController | null>(null);

export function useFolioAppearance(): FolioAppearanceController {
  const context = useContext(FolioAppearanceContext);
  if (!context) {
    throw new Error("useFolioAppearance must be used within FolioApp");
  }
  return context;
}
