import type {
  FolioAppearanceConfig,
  FolioCodePalette,
  FolioColorSchemePreference,
  FolioConfig,
  FolioVisualPreset,
} from "../types";

export type FolioResolvedAppearance = {
  preset: FolioVisualPreset;
  scheme: FolioColorSchemePreference;
  codePalette: FolioCodePalette;
};

const PRESETS: readonly FolioVisualPreset[] = ["pearl", "editorial", "graphite"];
const SCHEMES: readonly FolioColorSchemePreference[] = ["light", "dark", "system"];
const CODE_PALETTES: readonly FolioCodePalette[] = ["auto", "xuanzhi", "xuanmo", "porcelain"];

function option<T extends string>(
  value: T | undefined,
  allowed: readonly T[],
  fallback: T,
  name: string,
): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) {
    throw new Error(`Invalid Folio ${name}: ${JSON.stringify(value)}`);
  }
  return value;
}

/** One canonical configuration resolver for React and the static build. */
export function resolveFolioAppearance(
  config: Pick<FolioConfig, "appearance">,
): FolioResolvedAppearance {
  const a: FolioAppearanceConfig = config.appearance ?? {};
  return {
    preset: option(a.preset, PRESETS, "pearl", "appearance.preset"),
    scheme: option(a.scheme, SCHEMES, "system", "appearance.scheme"),
    codePalette: option(a.codePalette, CODE_PALETTES, "auto", "appearance.codePalette"),
  };
}

/** Explicit code palettes stay independent; auto favors Porcelain on light Pearl. */
export function resolveFolioCodePalette(
  preference: FolioCodePalette,
  effectiveScheme: "light" | "dark",
  preset?: FolioVisualPreset,
): Exclude<FolioCodePalette, "auto"> {
  if (preference !== "auto") return preference;
  if (effectiveScheme === "dark") return "xuanmo";
  return preset === "pearl" ? "porcelain" : "xuanzhi";
}
