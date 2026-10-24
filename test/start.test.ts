// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { type MiraContext, miraMiddleware } from "../src/start.ts"

const SECRET = "mf_ab12cd34_secretsecretsecretsecret"
const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
  Response.json({ batch: "b", accepted: 1, dropped: 0 }, { status: 202 })
)

const events = () =>
  fetchMock.mock.calls
    .filter(([url]) => url.endsWith("/v1/batch"))
    .flatMap(([, init]) => {
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${SECRET}`)
      return (JSON.parse(init?.body as string) as { events: { name: string; userId?: string }[] }).events
    })

type Server = (options: {
  request: Request
  pathname: string
  context: object
  handlerType: "router"
  next: (options?: { context?: MiraContext }) => Promise<{ response: Response; context: object }>
}) => Promise<unknown>

/** Runs the middleware as Start does, with `handle` standing in for the route. */
const run = async (
  middleware: ReturnType<typeof miraMiddleware>,
  handle: (context: MiraContext) => unknown,
  headers: Record<string, string> = {}
) => {
  const server = (middleware.options as unknown as { server: Server }).server
  const request = new Request("https://shop.example/checkout", { headers })

  return server({
    request,
    pathname: "/checkout",
    context: {},
    handlerType: "router",
    next: async (options) => {
      await handle(options!.context!)
      return { request, response: new Response("ok"), context: options!.context! }
    }
  }) as Promise<{ response: Response }>
}

beforeEach(() => {
  process.env["MIRAFIVE_SECRET_KEY"] = SECRET
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  fetchMock.mockClear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("miraMiddleware()", () => {
  it("puts mira on context and hands the flush to waitUntil once the response is ready", async () => {
    const waitUntil = vi.fn()
    const middleware = miraMiddleware({ waitUntil })
    let seen: MiraContext["mira"] | undefined

    await run(middleware, ({ mira }) => {
      seen = mira
      mira.track("checkout_rendered", { userId: "user-42" })
    })

    expect(waitUntil).toHaveBeenCalled()
    await Promise.all(waitUntil.mock.calls.map(([promise]) => promise))
    expect(events()).toEqual([expect.objectContaining({ name: "checkout_rendered", userId: "user-42" })])

    const { response } = await run(middleware, ({ mira }) => expect(mira).toBe(seen))

    expect(response.headers.get("cache-control")).toBeNull()
  })

  it("flushes even when the route throws", async () => {
    const waitUntil = vi.fn()

    await expect(
      run(miraMiddleware({ waitUntil }), ({ mira }) => {
        mira.track("failed_render")
        throw new Error("boom")
      })
    ).rejects.toThrow("boom")

    await Promise.all(waitUntil.mock.calls.map(([promise]) => promise))
    expect(events().map((event) => event.name)).toEqual(["failed_render"])
  })
})

describe("one client per key and host", () => {
  it("shares one client across factory calls, as createStart() makes per request", async () => {
    vi.stubEnv("MIRAFIVE_HOST", "https://eu.events.example")

    const seen = new Set<unknown>()

    for (let request = 0; request < 3; request += 1) {
      // oxlint-disable-next-line no-await-in-loop -- one request after another
      await run(miraMiddleware(), ({ mira }) => {
        seen.add(mira)
      })
    }

    expect(seen.size).toBe(1)
  })

  it("retries a start that failed instead of keeping the failure", async () => {
    const key = "mf_ab12cd34_retryretryretryretry"

    // new Mira() refuses to run where a browser's globals exist.
    vi.stubGlobal("window", {})
    vi.stubGlobal("document", {})
    await expect(run(miraMiddleware({ key }), () => {})).rejects.toThrow("server-only")
    vi.unstubAllGlobals()
    vi.stubGlobal("fetch", fetchMock)

    await expect(run(miraMiddleware({ key }), () => {})).resolves.toBeDefined()
  })

  it("runs where process does not exist", async () => {
    vi.stubGlobal("process", undefined)

    try {
      await expect(
        run(miraMiddleware(), ({ mira }) => {
          expect(mira).toBeDefined()
        })
      ).resolves.toBeDefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
