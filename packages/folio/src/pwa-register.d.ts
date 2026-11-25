// Ambient declaration for the upstream PWA registration client.
//
// `virtual:pwa-register/react` is provided by `vite-plugin-pwa` at build time.
// Folio restates only the surface it actually consumes so its own `.d.ts` can be
// generated without loading the plugin's ambient declarations, and so a consumer
// that never installs `vite-plugin-pwa` still type-checks the Folio entries.
// The real module is the upstream one: this file is a build-time declaration and
// is not copied into the published package.
declare module "virtual:pwa-register/react" {
  import type { Dispatch, SetStateAction } from "react";

  export type FolioPwaRegisterSWOptions = {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisterError?: (error: unknown) => void;
  };

  export function useRegisterSW(options?: FolioPwaRegisterSWOptions): {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
