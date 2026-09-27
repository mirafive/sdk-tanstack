"use client"

import { createMira, type FlagBootstrap, type Mira, type MiraOptions } from "@mirafive/sdk-browser"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { MiraProvider as Provider } from "@mirafive/sdk-react"
import { createElement, type ReactElement, type ReactNode } from "react"

export { useFlag, useFlagConfig, useMira, useTrackOnMount } from "@mirafive/sdk-react"
export type { FlagBootstrap } from "@mirafive/sdk-browser"

export interface MiraProviderProps extends Omit<MiraOptions, "key"> {
  /** The source's website key: `import.meta.env.VITE_MIRAFIVE_KEY`. */
  websiteKey: string | undefined
  /** `flags.bootstrap()` from `context.flagsFor()`, so flag hooks render the same on the server and in hydration. */
  bootstrap?: FlagBootstrap | string | undefined
  children?: ReactNode
}

let client: Mira | undefined
let warned = false

/** Creates the browser client on the first render in the browser and keeps it for the page's lifetime. */
export const MiraProvider = ({
  websiteKey,
  bootstrap,
  children,
  ...options
}: MiraProviderProps): ReactElement => {
  if (typeof window !== "undefined" && !client) {
    if (websiteKey) {
      const plugins = options.plugins ?? []

      client = createMira({
        ...options,
        key: websiteKey,
        plugins: plugins.some((plugin) => plugin.name === "pageviews") ? plugins : [pageviews(), ...plugins]
      })
    } else if (!warned) {
      warned = true
      // oxlint-disable-next-line no-console -- a missing key sends nothing, so say so once
      console.warn("[mirafive] no website key: pass websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}")
    }
  }

  return createElement(Provider, { client, bootstrap }, children)
}
