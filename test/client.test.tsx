import { autocapture } from "@mirafive/sdk-browser/autocapture"
import { identity } from "@mirafive/sdk-browser/identity"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { act, cleanup, render } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const KEY = "mf_ab12cd34_0123456789abcdefghijklmnop"
const w = window as unknown as Window & { happyDOM: { setURL(url: string): void } }
const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
  Response.json({ accepted: 1, dropped: 0 }, { status: 202 })
)

const sent = () =>
  fetchMock.mock.calls
    .filter(([url]) => url.includes("/v1/batch/"))
    .flatMap(([url, init]) =>
      (JSON.parse(init?.body as string) as { events: { name: string }[] }).events.map((event) => ({
        url,
        name: event.name
      }))
    )

// A fresh module per test: the provider keeps one client per page, like a real page load.
const load = async () => {
  vi.resetModules()
  return import("../src/index.ts")
}

beforeEach(() => {
  w.happyDOM.setURL("https://shop.example/")
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
  fetchMock.mockClear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, "__mirafive_boot")
})

describe("<MiraProvider>", () => {
  it("warns when a later render passes other plugins", async () => {
    const { MiraProvider } = await load()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const view = render(<MiraProvider websiteKey={KEY} plugins={[autocapture()]} />)

    view.rerender(<MiraProvider websiteKey={KEY} plugins={[autocapture()]} />)
    expect(warn).not.toHaveBeenCalled()

    view.rerender(<MiraProvider websiteKey={KEY} plugins={[autocapture(), identity()]} />)
    view.rerender(<MiraProvider websiteKey={KEY} plugins={[autocapture(), identity()]} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("pageviews,autocapture,identity")
  })

  it("creates one client under StrictMode and sends pageviews", async () => {
    const { MiraProvider, useMira } = await load()
    const seen = new Set<unknown>()
    const Reader = (): null => {
      seen.add(useMira())
      return null
    }
    const app = (
      <StrictMode>
        <MiraProvider websiteKey={KEY}>
          <Reader />
        </MiraProvider>
      </StrictMode>
    )
    const warn = vi.spyOn(console, "warn")
    const view = render(app)

    view.rerender(app)
    expect(seen.size).toBe(1)

    const [client] = seen as Set<{ flush(): Promise<void> }>

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await client?.flush()
    })

    expect(sent()).toEqual([
      {
        url: expect.stringMatching(new RegExp(`^https://[a-z]+\\.mirafive\\.io/v1/batch/${KEY}$`)),
        name: "$pageview"
      }
    ])
    // A second createMira() would have warned "second client stays inert".
    expect(warn).not.toHaveBeenCalled()
  })

  it("keeps a pageviews plugin the app passes instead of adding another", async () => {
    const { MiraProvider, useMira } = await load()
    let client: { flush(): Promise<void> } | undefined
    const Reader = (): null => {
      client = useMira()
      return null
    }

    render(
      <MiraProvider websiteKey={KEY} plugins={[pageviews({ initial: false })]}>
        <Reader />
      </MiraProvider>
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await client?.flush()
    })

    expect(sent()).toEqual([])
  })

  it("passes mode and plugins through to createMira", async () => {
    const { MiraProvider } = await load()

    expect(() => render(<MiraProvider websiteKey={KEY} mode="full" />)).toThrow(
      'mode "full" needs identity()'
    )
    cleanup()
    Reflect.deleteProperty(window, "__mirafive_boot")
    expect(() => render(<MiraProvider websiteKey={KEY} mode="full" plugins={[identity()]} />)).not.toThrow()
  })

  it("sends nothing and warns once without a key, in production builds too", async () => {
    vi.stubEnv("NODE_ENV", "production")

    const { MiraProvider } = await load()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const view = render(<MiraProvider websiteKey={undefined} />)

    view.rerender(<MiraProvider websiteKey={undefined} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
