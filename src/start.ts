import type { Mira } from "@mirafive/sdk-server"
import { createMiddleware, type RequestMiddlewareAfterServer } from "@tanstack/react-start"

export interface MiraMiddlewareOptions {
  /** Default `process.env.MIRAFIVE_SECRET_KEY`. */
  key?: string | undefined
  /** Default `process.env.MIRAFIVE_HOST`, else `https://collect.mirafive.io`. */
  host?: string | undefined
  /** The platform's `waitUntil` (`cloudflare:workers`, `@vercel/functions`), so deliveries outlive the response. */
  waitUntil?: ((promise: Promise<unknown>) => void) | undefined
}

/** What `miraMiddleware()` puts on `context`. */
export interface MiraContext {
  mira: Mira
}

// createStart() calls its factory per request, so a client made per miraMiddleware() call would be
// built again each time. One client per key and host, per process.
const clients = new Map<string, Promise<Mira>>()

const env = (name: string): string | undefined =>
  typeof process === "undefined" ? undefined : process.env[name]

const load = (key: string | undefined, host: string | undefined): Promise<Mira> => {
  const id = `${key}\n${host}`
  let loading = clients.get(id)

  if (!loading) {
    // Imported here: src/start.ts is bundled for the browser too, and the server SDK must not ride along.
    loading = import("@mirafive/sdk-server").then((server) => new server.Mira({ key, host }))
    clients.set(id, loading)
    // A failed start is retried by the next request.
    loading.catch(() => clients.delete(id))
  }

  return loading
}

/**
 * Request middleware: `context.mira`, flushed once the response is ready. Clients are shared per key and
 * host, so calling it per request (as `createStart()` does) costs nothing.
 */
export const miraMiddleware = ({
  key,
  host,
  waitUntil
}: MiraMiddlewareOptions = {}): RequestMiddlewareAfterServer<{}, undefined, MiraContext> =>
  createMiddleware().server(async ({ next }) => {
    const mira = await load(key ?? env("MIRAFIVE_SECRET_KEY"), host ?? env("MIRAFIVE_HOST"))

    try {
      return await next<MiraContext>({ context: { mira } })
    } finally {
      const flushed = mira.flush()

      waitUntil?.(flushed)
    }
  })
