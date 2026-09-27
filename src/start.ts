import type { Mira } from "@mirafive/sdk-server"
import type { FlagUnit, MiraFlags, UserFlags } from "@mirafive/sdk-server/flags"
import { createMiddleware, type RequestMiddlewareAfterServer } from "@tanstack/react-start"
import { createElement, type ReactElement } from "react"

export type { FlagUnit, UserFlags } from "@mirafive/sdk-server/flags"

export interface MiraMiddlewareOptions {
  /** Default `process.env.MIRAFIVE_SECRET_KEY`. */
  key?: string | undefined
  /** Default `process.env.MIRAFIVE_HOST`, else `https://events.mirafive.io`. */
  host?: string | undefined
  /** The platform's `waitUntil` (`cloudflare:workers`, `@vercel/functions`), so deliveries outlive the response. */
  waitUntil?: ((promise: Promise<unknown>) => void) | undefined
}

/** What `miraMiddleware()` puts on `context`. */
export interface MiraContext {
  mira: Mira
  /** One visitor's flags. `Sec-GPC: 1` or `DNT: 1` on the request sets `optedOut`. */
  flagsFor: (unit?: FlagUnit) => Promise<UserFlags>
}

type Clients = readonly [Mira, MiraFlags]

// createStart() calls its factory per request, so a client made per miraMiddleware() call would lose
// the flag document and the exposure dedup each time. One pair per key and host, per process.
const clients = new Map<string, Promise<Clients>>()

const env = (name: string): string | undefined =>
  typeof process === "undefined" ? undefined : process.env[name]

const load = (key: string | undefined, host: string | undefined): Promise<Clients> => {
  const id = `${key}\n${host}`
  let loading = clients.get(id)

  if (!loading) {
    // Imported here: src/start.ts is bundled for the browser too, and the server SDK must not ride along.
    loading = Promise.all([import("@mirafive/sdk-server"), import("@mirafive/sdk-server/flags")]).then(
      ([server, flagsModule]) => {
        const client = new server.Mira({ key, host })

        return [client, new flagsModule.MiraFlags({ key, host, mira: client })] as const
      }
    )
    clients.set(id, loading)
    // A failed start is retried by the next request.
    loading.catch(() => clients.delete(id))
  }

  return loading
}

/**
 * Request middleware: `context.mira` and `context.flagsFor`, flushed once the response is ready. A response
 * whose request read flags is sent with `Cache-Control: private, no-store`. Clients are shared per key and
 * host, so calling it per request (as `createStart()` does) costs nothing.
 */
export const miraMiddleware = ({
  key,
  host,
  waitUntil
}: MiraMiddlewareOptions = {}): RequestMiddlewareAfterServer<{}, undefined, MiraContext> =>
  createMiddleware().server(async ({ request, next }) => {
    const [mira, flags] = await load(key ?? env("MIRAFIVE_SECRET_KEY"), host ?? env("MIRAFIVE_HOST"))
    const optedOut = request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1"
    let personal = false

    try {
      const result = await next<MiraContext>({
        context: {
          mira,
          flagsFor: (unit = {}) => {
            personal = true
            return flags.for({ ...unit, optedOut: unit.optedOut || optedOut }, { waitUntil })
          }
        }
      })

      // One visitor's flags must never sit in a shared cache (FLAGS.md §5.3).
      try {
        if (personal) {
          result.response.headers.set("Cache-Control", "private, no-store")
        }
      } catch {
        // Immutable headers: a redirect or a proxied response, which carry no page.
      }

      return result
    } finally {
      const flushed = mira.flush()

      waitUntil?.(flushed)
    }
  })

/** The `<script id="mirafive-flags">` block the browser SDK reads at start. */
export const MiraFlagsScript = ({ flags }: { flags: UserFlags | string }): ReactElement => {
  const html = typeof flags === "string" ? flags : flags.bootstrap()

  // The block's JSON is escaped: it holds no `<` or `>` of its own.
  return createElement("script", {
    type: "application/json",
    id: "mirafive-flags",
    dangerouslySetInnerHTML: { __html: html.slice(html.indexOf(">") + 1, html.lastIndexOf("<")) }
  })
}
