"use client"

import { createMira, type FlagBootstrap, type Mira, type MiraOptions } from "@mirafive/sdk-browser"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { MiraProvider as Provider } from "@mirafive/sdk-react"
import { createElement, Fragment, type ReactElement, type ReactNode } from "react"

export { useFlag, useFlagConfig, useMira, useTrackOnMount } from "@mirafive/sdk-react"
export type { FlagBootstrap } from "@mirafive/sdk-browser"

export interface MiraProviderProps extends Omit<MiraOptions, "key"> {
  /** The source's website key: `import.meta.env.VITE_MIRAFIVE_KEY`. */
  websiteKey: string | undefined
  /**
   * `flags.bootstrap()` from `context.flagsFor()`. The provider renders it as the `mirafive-flags` block the
   * browser SDK reads, and flag hooks render it on the server and in hydration.
   */
  bootstrap?: FlagBootstrap | string | undefined
  children?: ReactNode
}

let client: Mira | undefined
let created: string | undefined
const warned = new Set<string>()

const escape = (json: string): string =>
  json.replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  )

const warn = (message: string): void => {
  if (!warned.has(message)) {
    warned.add(message)
    // oxlint-disable-next-line no-console -- configuration mistakes, reported once each
    console.warn("[mirafive] " + message)
  }
}

/** Creates the browser client on the first render in the browser and keeps it for the page's lifetime. */
export const MiraProvider = ({
  websiteKey,
  bootstrap,
  children,
  ...options
}: MiraProviderProps): ReactElement => {
  if (typeof window !== "undefined") {
    const plugins = options.plugins ?? []
    const given = plugins.map((plugin) => plugin.name)
    const names = (given.includes("pageviews") ? given : ["pageviews", ...given]).join()

    if (client) {
      // Every build: a package cannot read Vite's mode, and ignored plugins are a configuration mistake.
      if (names !== created) {
        warn(`plugins changed to ${names} after the client was created with ${created}; the first set stays`)
      }
    } else if (websiteKey) {
      created = names
      client = createMira({
        ...options,
        key: websiteKey,
        plugins: given.includes("pageviews") ? plugins : [pageviews(), ...plugins]
      })
    } else {
      warn("no website key: pass websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}")
    }
  }

  return createElement(
    Fragment,
    null,
    bootstrap &&
      createElement("script", {
        type: "application/json",
        id: "mirafive-flags",
        dangerouslySetInnerHTML: {
          __html: escape(
            typeof bootstrap === "string"
              ? bootstrap.replace(/^[^{]*|[^}]*$/g, "")
              : JSON.stringify(bootstrap)
          )
        }
      }),
    createElement(Provider, { client, bootstrap }, children)
  )
}
