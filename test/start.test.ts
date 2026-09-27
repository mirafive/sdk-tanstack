// @vitest-environment node
import type { Flag, FlagDocument } from "@mirafive/sdk-server/flags"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { type MiraContext, MiraFlagsScript, miraMiddleware } from "../src/start.ts"

const SECRET = "mf_ab12cd34_secretsecretsecretsecret"
const seed = "3f9a1c0b7e2d"
// With this seed user-42 buckets into variant b.
const pricing: Flag = {
  s: seed,
  t: "m",
  u: "p",
  d: "a",
  p: { a: "Original", b: "Stop paying" },
  r: [
    {
      w: [
        ["a", 5000],
        ["b", 5000]
      ]
    }
  ],
  e: "o",
  c: "s",
  w: 1
}
const hostile = "</script><!-- "
const document: FlagDocument = {
  v: 1,
  at: Date.now(),
  flags: {
    pricing,
    limits: { s: seed, t: "c", u: "p", d: "pro", p: { pro: { note: hostile } }, r: [], w: 1 },
    internal: { s: seed, t: "b", u: "p", d: "on", r: [] }
  }
}

const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
  url.endsWith("/v1/flags")
    ? Response.json(document)
    : Response.json({ batch: "b", accepted: 1, dropped: 0 }, { status: 202 })
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

  it("evaluates flags for the unit and counts server experiments", async () => {
    const middleware = miraMiddleware()
    let variant: string | undefined

    const { response } = await run(middleware, async ({ flagsFor }) => {
      variant = (await flagsFor({ userId: "user-42" })).variant("pricing", "a")
    })

    expect(response.headers.get("cache-control")).toBe("private, no-store")
    await vi.waitFor(() => expect(events().map((event) => event.name)).toEqual(["$exposure"]))
    expect(variant).toBe("b")
  })

  it.each([
    ["sec-gpc", "1"],
    ["dnt", "1"]
  ])("honours %s: %s as an opt-out", async (name, value) => {
    let answer: unknown

    await run(
      miraMiddleware(),
      async ({ flagsFor }) => {
        answer = (await flagsFor({ userId: "user-42" })).evaluate("pricing")
      },
      { [name]: value }
    )

    expect(answer).toMatchObject({ variant: "a", errorCode: "NOT_ALLOWED" })
  })
})

describe("<MiraFlagsScript>", () => {
  it("renders the escaped bootstrap block, with only flags the website reads", async () => {
    let html = ""

    await run(miraMiddleware(), async ({ flagsFor }) => {
      const user = await flagsFor({ userId: "user-42" })

      html = renderToStaticMarkup(MiraFlagsScript({ flags: user }))
      expect(html).toBe(user.bootstrap())
    })

    expect(html).toContain('id="mirafive-flags"')
    expect(html).not.toContain(hostile)
    expect(html).not.toContain("internal")
    expect(renderToStaticMarkup(MiraFlagsScript({ flags: html }))).toBe(html)
  })
})
