# @mirafive/sdk-tanstack

MIRA FIVE for TanStack Start and TanStack Router: a client provider with feature-flag
hooks, and request middleware that puts server events and flags on `context` and sends
them once the response is ready. Privacy-first analytics and feature flags from MIRA FIVE,
hosted in the EU.

## Size

| Import | min + gzip |
|---|---|
| `@mirafive/sdk-tanstack` (client) | 0.77 kB |
| `@mirafive/sdk-tanstack` + `@mirafive/sdk-react` | 1.29 kB |
| `@mirafive/sdk-tanstack/start` | 0.75 kB |

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
// src/flags.ts: server functions get context.mira and context.flagsFor
import { createServerFn } from "@tanstack/react-start"

export const getFlagBootstrap = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const flags = await context.flagsFor({ userId: undefined }) // your own pseudonymous id, if signed in

  return flags.bootstrap()
})

export const trackSignup = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ context, data }) => {
    context.mira.track("signup", { userId: data.userId, properties: { plan: "pro" } })
  })
```

```tsx
// src/routes/__root.tsx
import { flags } from "@mirafive/sdk-browser/flags"
import { MiraProvider } from "@mirafive/sdk-tanstack"
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"

import { getFlagBootstrap } from "../flags"

export const Route = createRootRoute({
  loader: () => getFlagBootstrap(),
  staleTime: Infinity, // the bootstrap only matters for the first server render
  shellComponent: ({ children }) => (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  ),
  component: function Root() {
    const bootstrap = Route.useLoaderData()

    // Renders the mirafive-flags block and hands the same answers to the flag hooks.
    return (
      <MiraProvider websiteKey={import.meta.env.VITE_MIRAFIVE_KEY} bootstrap={bootstrap} plugins={[flags()]}>
        <Outlet />
      </MiraProvider>
    )
  }
})
```

```tsx
// any component
import { useFlag, useFlagConfig, useMira, useTrackOnMount } from "@mirafive/sdk-tanstack"

function Checkout() {
  const newCheckout = useFlag("new-checkout", false)
  const { max } = useFlagConfig("limits", { max: 1 })
  const mira = useMira()

  useTrackOnMount("checkout_viewed")
  return <button onClick={() => mira.track("buy_clicked")}>{newCheckout === true ? `Buy up to ${max}` : "Buy"}</button>
}
```

Analytics only, or a TanStack Router SPA without Start: render
`<MiraProvider websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}>` around the app and skip
the rest. Pageviews are counted on every navigation.

A working Start app lives in [`examples/start`](examples/start) (`bun run example` packs
the SDKs, installs them as npm would, and runs `vite build`).

Verify it: open a page on a deployed host (not `localhost`) and look for
`POST https://events.mirafive.io/v1/batch/mf_…` answering `202` in the network tab; the
pageview then shows in the source's live view. Server side, a server function running
`await context.mira.send([{ name: "$install_check" }])` resolves to
`{ accepted: 0, dropped: 1, reason: "install_check" }` when the secret key and host work.

## Consent & privacy

- Default mode: `consentless` in the browser. No cookies, no storage, no ids; it needs no
  consent banner. `mode="full"` adds an anonymous id, a session id and your user id; it
  needs `identity()` in `plugins` and a consent answer
  (`useMira().consent({ statistics, experiments, targeting })`) from your consent
  manager. Before an answer nothing is stored.
- Server events (`context.mira`) default to `full` mode: you decide the lawful basis for
  the ids you send.
- Do Not Track, Global Privacy Control, `window.__mirafive_ignore` and prerendering send
  nothing from the browser. On the server, `context.flagsFor()` reads `Sec-GPC: 1` and
  `DNT: 1` from the request and passes `optedOut`: no ids, no segment lookup, no exposure.
- A response whose request read flags gets `Cache-Control: private, no-store`, so one
  visitor's flags never sit in a shared cache.
- This package stores nothing. It reads `MIRAFIVE_SECRET_KEY` and `MIRAFIVE_HOST` on the
  server and the `Sec-GPC`/`DNT` request headers.

## API reference

`@mirafive/sdk-tanstack`:

- `<MiraProvider websiteKey host? mode? plugins? flushAt? flushAfterMs? trackLocalhost? bootstrap?>`:
  creates the browser client once, on the first render in the browser, and keeps it for
  the page's lifetime (later prop changes are ignored, and a changed plugin set is warned
  about). Pass `websiteKey={import.meta.env.VITE_MIRAFIVE_KEY}`. `pageviews()` is added
  unless `plugins` already holds one. `bootstrap` is `flags.bootstrap()` or a
  `FlagBootstrap`: the provider renders it as the `mirafive-flags` block and hands it to
  the hooks. Without a key it sends nothing and warns once, in every build.
- `useMira()`, `useFlag(key, fallback)`, `useFlagConfig(key, fallback)`,
  `useTrackOnMount(name, properties?)`: re-exported from `@mirafive/sdk-react`.
- `type MiraProviderProps`, `type FlagBootstrap`.

`@mirafive/sdk-tanstack/start`:

- `miraMiddleware({ key?, host?, waitUntil? })`: TanStack Start request middleware. Puts
  `mira` and `flagsFor(unit?)` on `context`. One `Mira` and one `MiraFlags` per process for
  each key (`key` or `MIRAFIVE_SECRET_KEY`) and host (`host` or `MIRAFIVE_HOST`), however
  often it is called; a failed start is retried by the next request. It flushes when the
  response is ready, handing the delivery to `waitUntil` when given, and sets
  `Cache-Control: private, no-store` when flags were read.
- `<MiraFlagsScript flags={UserFlags | string} />`: the escaped
  `<script type="application/json" id="mirafive-flags">` block, for pages whose provider
  gets no `bootstrap`. Never together with a provider `bootstrap`: that renders the block
  already.
- `type MiraContext` (`{ mira, flagsFor }`), `type MiraMiddlewareOptions`,
  `type FlagUnit`, `type UserFlags`.

## Framework / runtime notes

- **Why `websiteKey`, not `key`:** React reserves the `key` prop. It is required rather
  than read from `import.meta.env` inside the package, because Vite only replaces
  `import.meta.env` in your own code.
- **Hydration:** flag hooks render `bootstrap` on the server and during hydration, then
  the browser SDK's answers, re-rendering only when an answer really changes. A bootstrap
  older than 7 days is ignored, as the browser SDK ignores it. Without `flags()` in
  `plugins`, hooks fall back after hydration.
- **Where context is available:** server functions and server routes see `context.mira`
  and `context.flagsFor` from the global request middleware. Route loaders are
  isomorphic: read flags through a server function, as above.
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
- **CSP:** the bootstrap block is `type="application/json"`, which `script-src` does not
  govern. Allow `connect-src https://events.mirafive.io`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Nothing arrives | Local hosts are off by default (`trackLocalhost`); Do Not Track or GPC is on; `VITE_MIRAFIVE_KEY` was not set at build time; the origin is not allowed on the source. |
| `403 secret_key_in_path` / `website_key_as_bearer` | The key kinds are swapped: the provider takes the website key, the middleware the secret key. |
| `403 origin_not_allowed` | Add the site's origin to the source in MIRA FIVE. |
| A flag always returns its fallback | No `flags()` in `plugins`; the flag is not in this source or not marked for the website (a bootstrap carries only those); experiments consent is missing; `MIRAFIVE_SECRET_KEY` is missing on the server (`[mirafive] no key` in the logs). |
| `context.mira` is undefined | `miraMiddleware()` is not in `requestMiddleware` in `src/start.ts`. |
| Server events lost on Workers or Vercel | Pass the platform's `waitUntil` to `miraMiddleware()`. |

## For AI agents

Copy-paste setup prompt:

```text
Add MIRA FIVE analytics (and feature flags) to this TanStack Start app with @mirafive/sdk-tanstack.
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
   For flags: a server function returning (await context.flagsFor({ userId })).bootstrap(), called from
   the root route's loader (staleTime: Infinity); pass bootstrap={bootstrap} plugins={[flags()]} to
   MiraProvider (flags from "@mirafive/sdk-browser/flags"). The provider renders the flags block itself:
   do not add <MiraFlagsScript> as well.
   Read flags with useFlag(key, fallback) / useFlagConfig(key, fallback).
   On Cloudflare Workers or Vercel pass the platform's waitUntil: miraMiddleware({ waitUntil }).
4. Keep the default consentless mode: it needs no banner. Only if a consent manager exists and ids
   are wanted: plugins={[identity()]} from "@mirafive/sdk-browser/identity" plus mode="full", and
   useMira().consent({ statistics, experiments, targeting }) in its callback.
5. Verify: run the production build (vite build); open a deployed page and check the network tab for
   POST https://events.mirafive.io/v1/batch/<key> answering 202; server side, a server function running
   await context.mira.send([{ name: "$install_check" }]) answers reason "install_check". Report what changed.
Do not add other analytics libraries, cookies or consent banners.
```

Facts for agents:

- Imports (client): `import { MiraProvider, useMira, useFlag, useFlagConfig, useTrackOnMount } from "@mirafive/sdk-tanstack"`.
  Plugins: `import { flags } from "@mirafive/sdk-browser/flags"`, `/identity`,
  `/autocapture`, `/search`, `/experiments`. `pageviews()` is added for you.
- Imports (Start server side): `import { miraMiddleware, MiraFlagsScript } from "@mirafive/sdk-tanstack/start"`.
  The middleware is created once at module scope of `src/start.ts`
  (`const mirafive = miraMiddleware()`), never inside the `createStart` factory.
  `MiraFlagsScript` is only for pages whose provider gets no `bootstrap`.
- Env vars: `VITE_MIRAFIVE_KEY` (public website key, passed as `websiteKey`),
  `MIRAFIVE_SECRET_KEY` (server only), `MIRAFIVE_HOST` (optional, server, default
  `https://events.mirafive.io`); the provider's `host` prop sets the browser host.
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
