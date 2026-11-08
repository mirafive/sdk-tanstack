import type { Mira, MiraOptions } from "@mirafive/node";
/**
 * `@mirafive/tanstack/start`: request middleware for TanStack Start that puts a server client on
 * `context.mira` and sends its events once the response is ready.
 *
 * ```ts
 * // src/start.ts
 * import { createStart } from "@tanstack/react-start";
 * import { miraMiddleware } from "@mirafive/tanstack/start";
 *
 * export const startInstance = createStart(() => ({ requestMiddleware: [miraMiddleware()] }));
 *
 * // in a server function or route handler
 * context.mira.revenue({ userId, amount: 4900, currency: "EUR", entryId: `order:${id}` });
 * ```
 */
import { createMiddleware } from "@tanstack/react-start";

export type { Mira, MiraOptions } from "@mirafive/node";

export interface MiraMiddlewareOptions extends MiraOptions {
  /**
   * The platform's `waitUntil` (Cloudflare `ctx.waitUntil`, `@vercel/functions`), so delivery
   * outlives the response on serverless platforms.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
}

/** What `miraMiddleware()` adds to `context`. */
export interface MiraContext {
  mira: Mira;
}

// createStart() runs its factory per request, so one client per key and host for the process.
const clients = new Map<string, Promise<Mira>>();

function shared(options: MiraOptions): Promise<Mira> {
  const id = `${options.secretKey ?? ""}\n${options.host ?? ""}`;
  let client = clients.get(id);
  if (!client) {
    // Imported on first use: this file is also bundled for the browser, the server SDK is not.
    client = import("@mirafive/node").then((server) => new server.Mira(options));
    clients.set(id, client);
    client.catch(() => clients.delete(id));
  }
  return client;
}

/**
 * The middleware. The secret key defaults to `MIRAFIVE_SECRET_KEY` and the host to
 * `MIRAFIVE_HOST`; calling it per request costs nothing.
 */
export function miraMiddleware({ waitUntil, ...options }: MiraMiddlewareOptions = {}) {
  return createMiddleware().server(async ({ next }) => {
    const mira = await shared(options);
    try {
      return await next({ context: { mira } satisfies MiraContext });
    } finally {
      const flushed = mira.flush();
      waitUntil?.(flushed);
    }
  });
}
