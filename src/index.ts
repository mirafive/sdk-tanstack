"use client";
/**
 * `@mirafive/tanstack`: MIRA FIVE for TanStack Start and TanStack Router apps.
 *
 * ```tsx
 * // src/routes/__root.tsx
 * import { MiraProvider } from "@mirafive/tanstack";
 *
 * <MiraProvider publicKey={import.meta.env.VITE_MIRAFIVE_KEY}>
 *   <Outlet />
 * </MiraProvider>
 * ```
 *
 * Route changes are captured as pageviews on their own. Server functions and request handlers
 * get a server client from `miraMiddleware()` in `@mirafive/tanstack/start`.
 */
export {
  MiraProvider,
  useIdentify,
  useMira,
  useTrackOnMount,
  type EventMap,
  type Mira,
  type MiraOptions,
  type MiraProviderProps,
} from "@mirafive/react";
