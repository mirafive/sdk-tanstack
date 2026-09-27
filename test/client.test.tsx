import { flags } from "@mirafive/sdk-browser/flags"
import { identity } from "@mirafive/sdk-browser/identity"
import { pageviews } from "@mirafive/sdk-browser/pageviews"
import { act, cleanup, render } from "@testing-library/react"
import { type ReactElement, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const KEY = "mf_ab12cd34_0123456789abcdefghijklmnop"
const w = window as unknown as Window & { happyDOM: { setURL(url: string): void } }
const block = `<script type="application/json" id="mirafive-flags">${JSON.stringify({
  v: 1,
  at: Date.now(),
  values: { "new-checkout": ["on"], limits: ["pro", { max: 3 }] }
})}</script>`

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
  it("renders the bootstrap on the server without a client, then hydrates to the same markup", async () => {
    const { MiraProvider, useFlag, useFlagConfig } = await load()
    const Checkout = (): ReactElement => (
      <p>
        {String(useFlag("new-checkout", false))} {useFlagConfig("limits", { max: 1 }).max}
      </p>
    )
    const app = (
      <MiraProvider websiteKey={KEY} bootstrap={block} plugins={[flags()]}>
        <Checkout />
      </MiraProvider>
    )

    vi.stubGlobal("window", undefined)
    const html = renderToString(app)
    vi.unstubAllGlobals()
    vi.stubGlobal("fetch", fetchMock)

    expect(html).toContain("true<!-- --> <!-- -->3")
    expect(fetchMock).not.toHaveBeenCalled()

    // The provider renders the block itself, ahead of the app, as it will be when the browser SDK starts.
    expect(html.startsWith(block)).toBe(true)
    document.body.innerHTML = `<div id="root">${html}</div>`

    const root = document.getElementById("root")!
    const recoverable = vi.fn()

    await act(async () => {
      hydrateRoot(root, app, { onRecoverableError: recoverable })
    })

    expect(recoverable).not.toHaveBeenCalled()
    expect(document.querySelectorAll("#mirafive-flags")).toHaveLength(1)
    expect(root.querySelector("p")?.textContent).toBe("true 3")
    // Answered from the block: nothing was fetched.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("renders the bootstrap block once, where the browser SDK reads it", async () => {
    const { MiraProvider } = await load()
    const object = {
      v: 1 as const,
      at: Date.now(),
      values: { note: ["on", "</script>\u2028"] as [string, string] }
    }

    vi.stubGlobal("window", undefined)
    const fromString = renderToString(<MiraProvider websiteKey={KEY} bootstrap={block} />)
    const fromObject = renderToString(<MiraProvider websiteKey={KEY} bootstrap={object} />)
    vi.unstubAllGlobals()

    expect(fromString).toBe(block)
    expect(fromString.match(/mirafive-flags/g)).toHaveLength(1)
    expect(fromObject).not.toContain("</script>\u2028")
    expect(JSON.parse(fromObject.slice(fromObject.indexOf(">") + 1, fromObject.lastIndexOf("<")))).toEqual(
      object
    )
    expect(renderToString(<MiraProvider websiteKey={KEY} />)).not.toContain("mirafive-flags")
  })

  it("warns when a later render passes other plugins", async () => {
    const { MiraProvider } = await load()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const view = render(<MiraProvider websiteKey={KEY} plugins={[flags()]} />)

    view.rerender(<MiraProvider websiteKey={KEY} plugins={[flags()]} />)
    expect(warn).not.toHaveBeenCalled()

    view.rerender(<MiraProvider websiteKey={KEY} plugins={[flags(), identity()]} />)
    view.rerender(<MiraProvider websiteKey={KEY} plugins={[flags(), identity()]} />)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("pageviews,flags,identity")
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

    expect(sent()).toEqual([{ url: `https://events.mirafive.io/v1/batch/${KEY}`, name: "$pageview" }])
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
