# @mirafive/sdk-tanstack

MIRA FIVE for TanStack Start and TanStack Router: a client provider, and request
middleware that puts server events on `context` and sends them once the response is
ready. Privacy-first analytics from MIRA FIVE, hosted in the EU.

## Size

| Import | min + gzip |
|---|---|
| `@mirafive/sdk-tanstack` (client) | 0.55 kB |
| `@mirafive/sdk-tanstack` + `@mirafive/sdk-react` | 1.07 kB |
| `@mirafive/sdk-tanstack/start` | 0.44 kB |

Measured with the peers external (`react`, `@tanstack/react-start`,
`@mirafive/sdk-browser`, `@mirafive/sdk-server`, and `@mirafive/sdk-react` in the first
row): these are the bytes this package adds. The browser SDK core with pageviews is
2.31 kB on top. The middleware loads `@mirafive/sdk-server` lazily on the server, so it
never reaches the browser bundle, although `src/start.ts` is bundled for both. What you
do not import is not shipped (`sideEffects: false`).

## Install

```sh
npm install @mirafive/sdk-tanstack @mirafive/sdk-react @mirafive/sdk-browser @mirafive/sdk-server
# or: bun add / pnpm add / yarn add
```

Peers: `react` ≥ 18.3, `@mirafive/sdk-react` and `@mirafive/sdk-browser` ^1.0.0; for
`/start` also `@tanstack/react-start` ≥ 1.168 and `@mirafive/sdk-server` ^1.0.0. A
TanStack Router SPA without Start needs only the first three.

## Quickstart

`.env`:

```sh
VITE_MIRAFIVE_KEY=mf_…     # the source's website key, public
MIRAFIVE_SECRET_KEY=mf_…   # the source's secret key, server only (never VITE_-prefixed)
```

```ts
// src/start.ts
import { miraMiddleware } from "@mirafive/sdk-tanstack/start"
import { createStart } from "@tanstack/react-start"

// Created once, outside the factory: createStart() runs its factory per request.
const mirafive = miraMiddleware()

export const startInstance = createStart(() => ({
  requestMiddleware: [mirafive]
}))
```

```ts
// src/signup.ts: server functions get context.mira
import { createServerFn } from "@tanstack/react-start"

export const trackSignup = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ context, data }) => {
    context.mira.track("signup", { userId: data.userId, properties: { plan: "pro" } })
  })
```

```tsx
// src/routes/__root.tsx
import { MiraProvider } from "@mirafive/sdk-tanstack"
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"

export const Route = createRootRoute({
  shellComponent: ({ children }) => (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  ),
  component: () => (
    <MiraProvider websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}>
      <Outlet />
    </MiraProvider>
  )
})
```

```tsx
// any component
import { useMira, useTrackOnMount } from "@mirafive/sdk-tanstack"

function Checkout() {
  const mira = useMira()

  useTrackOnMount("checkout_viewed")
  return <button onClick={() => mira.track("buy_clicked")}>Buy</button>
}
```

A TanStack Router SPA without Start: render
`<MiraProvider websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}>` around the app and skip
the middleware. Pageviews are counted on every navigation.

A working Start app lives in [`examples/start`](examples/start) (`bun run example` packs
the SDKs, installs them as npm would, and runs `vite build`).

For revenue, add `payment_id` (1–255 characters) to the properties next to `revenue` and `currency`: the payment provider's id of the payment. For Stripe pass the Checkout Session id on the success page or the PaymentIntent id from a webhook, for example `context.mira.track("order completed", { properties: { revenue: 49, currency: "EUR", payment_id: paymentIntent.id } })`. MIRA FIVE merges the event with the payment it imports from your connected Stripe account, so the sale counts once.

Verify it: open a page on a deployed host (not `localhost`) and look for
`POST https://collect.mirafive.io/v1/batch/mf_…` answering `202` in the network tab; the
pageview then shows in the source's live view. Server side, a server function running
`await context.mira.send([{ name: "$install_check" }])` resolves to
`{ accepted: 0, dropped: 1, reason: "install_check" }` when the secret key and host work.

## Consent & privacy

- Default mode: `consentless` in the browser. No cookies, no storage, no ids; it needs no
  consent banner. `mode="full"` adds an anonymous id, a session id and your user id; it
  needs `identity()` in `plugins` and a consent answer
  (`useMira().consent({ statistics })`) from your consent
  manager. Before an answer nothing is stored.
- Statistics is the only consent purpose. The old `experiments` and `targeting` keys are accepted and ignored.
- Server events (`context.mira`) default to `full` mode: you decide the lawful basis for
  the ids you send.
- Do Not Track, Global Privacy Control, `window.__mirafive_ignore` and prerendering send
  nothing from the browser.
- This package stores nothing. It reads `MIRAFIVE_SECRET_KEY` and `MIRAFIVE_HOST` on the
  server.

## API reference

`@mirafive/sdk-tanstack`:

- `<MiraProvider websiteKey host? mode? plugins? flushAt? flushAfterMs? trackLocalhost?>`:
  creates the browser client once, on the first render in the browser, and keeps it for
  the page's lifetime (later prop changes are ignored, and a changed plugin set is warned
  about). Pass `websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}`. `pageviews()` is added
  unless `plugins` already holds one. Without a key it sends nothing and warns once, in every build.
- `useMira()`, `useTrackOnMount(name, properties?)`: re-exported from `@mirafive/sdk-react`.
- `type MiraProviderProps`.

`@mirafive/sdk-tanstack/start`:

- `miraMiddleware({ key?, host?, waitUntil? })`: TanStack Start request middleware. Puts
  `mira` on `context`. One `Mira` per process for
  each key (`key` or `MIRAFIVE_SECRET_KEY`) and host (`host` or `MIRAFIVE_HOST`), however
  often it is called; a failed start is retried by the next request. It flushes when the
  response is ready, handing the delivery to `waitUntil` when given.
- `type MiraContext` (`{ mira }`), `type MiraMiddlewareOptions`.

## Framework / runtime notes

- **Why `websiteKey`, not `key`:** React reserves the `key` prop. It is required rather
  than read from `import.meta.env` inside the package, because Vite only replaces
  `import.meta.env` in your own code.
- **Where context is available:** server functions and server routes see `context.mira`
  from the global request middleware. Route loaders are
  isomorphic: track from a server function, as above.
- **Serverless and edge:** on Node the process keeps running and the flush completes on
  its own. On Cloudflare Workers pass
  `miraMiddleware({ waitUntil })` with `waitUntil` from `cloudflare:workers`; on Vercel,
  `waitUntil` from `@vercel/functions`.
  Events tracked while a streamed body is still rendering leave with the client's
  one-second timer, which `waitUntil` does not cover: track in server functions and
  routes, not during streaming.
- **Where the middleware lives:** create it once at module scope and put that value in
  `requestMiddleware`. Calling `miraMiddleware()` inside the `createStart` factory also
  works (the clients are shared), but builds a new middleware per request.
- **No `process`:** on runtimes without `process.env`, pass `key` and `host`.
- **Navigation:** `pageviews()` counts TanStack Router navigations through the Navigation
  API or the History API; there is no router subscription to add.
- **CSP:** allow `connect-src https://collect.mirafive.io`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Nothing arrives | Local hosts are off by default (`trackLocalhost`); Do Not Track or GPC is on; `VITE_MIRAFIVE_KEY` was not set at build time; the origin is not allowed on the source. |
| `403 secret_key_in_path` / `website_key_as_bearer` | The key kinds are swapped: the provider takes the website key, the middleware the secret key. |
| `403 origin_not_allowed` | Add the site's origin to the source in MIRA FIVE. |
| `context.mira` is undefined | `miraMiddleware()` is not in `requestMiddleware` in `src/start.ts`. |
| Server events lost on Workers or Vercel | Pass the platform's `waitUntil` to `miraMiddleware()`. |

## For AI agents

Copy-paste setup prompt:

```text
Add MIRA FIVE analytics to this TanStack Start app with @mirafive/sdk-tanstack.
1. Install @mirafive/sdk-tanstack @mirafive/sdk-react @mirafive/sdk-browser @mirafive/sdk-server with
   the project's package manager.
2. Add to .env (and the deployment's env): VITE_MIRAFIVE_KEY=<website key, mf_…> and
   MIRAFIVE_SECRET_KEY=<secret key>. The secret key is server-only: never VITE_-prefixed, never
   read in a component; only "@mirafive/sdk-tanstack/start" uses it.
3. In src/start.ts: const mirafive = miraMiddleware() at module scope (miraMiddleware from
   "@mirafive/sdk-tanstack/start"), then createStart(() => ({ requestMiddleware: [mirafive] }))
   (create the file if missing; keep existing middleware).
   In src/routes/__root.tsx wrap the Outlet in
   <MiraProvider websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}> from "@mirafive/sdk-tanstack".
   That alone counts pageviews on every navigation; do not add router subscriptions.
   Track in components with useMira().track(name, props) or useTrackOnMount(name, props); on the
   server inside createServerFn handlers with context.mira.track(name, { userId, properties }).
   On Cloudflare Workers or Vercel pass the platform's waitUntil: miraMiddleware({ waitUntil }).
4. Keep the default consentless mode: it needs no banner. Only if a consent manager exists and ids
   are wanted: plugins={[identity()]} from "@mirafive/sdk-browser/identity" plus mode="full", and
   useMira().consent({ statistics }) in its callback.
5. Verify: run the production build (vite build); open a deployed page and check the network tab for
   POST https://collect.mirafive.io/v1/batch/<key> answering 202; server side, a server function running
   await context.mira.send([{ name: "$install_check" }]) answers reason "install_check". Report what changed.
Do not add other analytics libraries, cookies or consent banners.
```

Facts for agents:

- Imports (client): `import { MiraProvider, useMira, useTrackOnMount } from "@mirafive/sdk-tanstack"`.
  Plugins: `import { identity } from "@mirafive/sdk-browser/identity"`, `/autocapture`,
  `/search`. `pageviews()` is added for you.
- Imports (Start server side): `import { miraMiddleware } from "@mirafive/sdk-tanstack/start"`.
  The middleware is created once at module scope of `src/start.ts`
  (`const mirafive = miraMiddleware()`), never inside the `createStart` factory.
- Env vars: `VITE_MIRAFIVE_KEY` (public website key, passed as `websiteKey`),
  `MIRAFIVE_SECRET_KEY` (server only), `MIRAFIVE_HOST` (optional, server, default
  `https://collect.mirafive.io`); the provider's `host` prop sets the browser host.
- Never ship `MIRAFIVE_SECRET_KEY` to a browser bundle; a secret key in a browser is
  refused and marked exposed. Never prefix it with `VITE_`.
- The provider prop is `websiteKey`, not `key` (React reserves `key`), and it is required.
- Consentless (default) needs no banner; `mode="full"` needs `identity()` and a consent
  answer, behind the site's CMP.
- Nothing throws for transport reasons. Browser: dropped with a `[mirafive] …` warning on
  local hosts only. Server: `console.warn("[mirafive] …")`, or `send()` rejects with
  `MiraError`.
- Verify an install: `vite build` passes; a deployed page's network tab shows
  `POST …/v1/batch/{key}` answering `202`; `context.mira.send([{ name: "$install_check" }])`
  answers `reason: "install_check"`.
- Wire contract: [mirafive/protocol](https://github.com/mirafive/protocol).

## License

[MIT](LICENSE) © 2026 Cloo GmbH
