# @mirafive/tanstack

MIRA FIVE for TanStack Start and TanStack Router: consent-aware analytics in the browser, and
request middleware that gives server functions and routes a server client on `context.mira`,
flushed once the response is ready. Built on
[`@mirafive/web`](https://github.com/mirafive/sdk-web) and
[`@mirafive/node`](https://github.com/mirafive/sdk-node); no other dependencies.

## Install

```sh
npm install @mirafive/tanstack   # or: bun add, pnpm add, yarn add
```

```sh
# .env
VITE_MIRAFIVE_KEY=mira_pk_…     # public key: browser
MIRAFIVE_SECRET_KEY=mira_sk_…   # secret key: server only, never VITE_
```

## Browser

```tsx
// src/routes/__root.tsx
import { MiraProvider } from "@mirafive/tanstack";

function RootComponent() {
  return (
    <MiraProvider publicKey={import.meta.env.VITE_MIRAFIVE_KEY}>
      <Outlet />
    </MiraProvider>
  );
}
```

Route changes are pageviews automatically. `useMira`, `useIdentify` and `useTrackOnMount`
work as in [`@mirafive/react`](https://github.com/mirafive/sdk-react#api).

## Server (TanStack Start)

```ts
import { miraMiddleware } from "@mirafive/tanstack/start";
// src/start.ts
import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  requestMiddleware: [miraMiddleware()],
}));
```

```ts
// a server function
export const checkout = createServerFn({ method: "POST" }).handler(async ({ context, data }) => {
  context.mira.revenue({
    userId: data.userId,
    amount: data.totalCents,
    currency: "EUR",
    entryId: `order:${data.orderId}`,
  });
});
```

`miraMiddleware(options?)` takes every `@mirafive/node` option (the secret key defaults to
`MIRAFIVE_SECRET_KEY`) plus `waitUntil` for serverless platforms (Cloudflare `ctx.waitUntil`,
`@vercel/functions`), so delivery outlives the response.

## For AI coding assistants

Rules for integrating MIRA FIVE correctly. They hold for every MIRA FIVE SDK.

- **Keys:** the public key (`mira_pk_…`) goes in browser and app code. The secret key (`mira_sk_…`)
  goes only into the server's environment (`MIRAFIVE_SECRET_KEY`), never into client code, a
  `NEXT_PUBLIC_`/`VITE_`/`PUBLIC_` variable or a repository. The SDKs refuse the wrong key.
- **Money** is sent only from the server: integer minor units plus an ISO 4217 currency
  (`amount: 1999, currency: "EUR"` is 19.99 EUR), never floats.
- **Count once:** give money an `entryId` from the payment provider (`stripe:in_123`), so the
  Stripe connector and retries do not double it. Give business events a stable id:
  `eventId: await eventIdFor("order:123:paid")`. The same key gives the same id in every SDK.
- **Personal data** never goes into event names or properties. Use your own user id (not an email)
  for `identify`; put email, name and phone in its traits, which MIRA FIVE encrypts at rest.
- **Consent:** keep `consent: "auto"`; it follows the site's consent banner (Usercentrics,
  Cookiebot, consentmanager, CCM19, Borlabs, any TCF 2.2 CMP, Google Consent Mode). Call
  `consent()` only for a custom banner. Do not gate the SDK behind consent yourself: without
  consent it is cookieless and still counts.
- **Never block on analytics:** event methods return nothing, never throw, and batch on their
  own. Do not `await` or `try` them. Call `flush()`/`shutdown()` only at the end of a script or a
  serverless function.
- **Server events and visitors:** pass the browser's `mira.anonymousId` to your server and set it
  as `anonymousId` on server events, so a purchase joins the visit and its source.
