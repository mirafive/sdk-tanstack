# Agents working in mirafive/sdk-tanstack

`@mirafive/sdk-tanstack`: MIRA FIVE for TanStack Start and TanStack Router, a
`"use client"` provider over `@mirafive/sdk-react` and a `/start` entry (request
middleware, bootstrap block) over `@mirafive/sdk-server`. Part of the MIRA FIVE SDK
family; the wire contract, flag semantics and public API live in
[mirafive/protocol](https://github.com/mirafive/protocol) (PROTOCOL.md, FLAGS.md, API.md).

## Commands

```sh
bun install --frozen-lockfile
bun run check            # format, lint, typecheck, test, build, publint, attw, size-limit
bun run test             # vitest: client (happy-dom) and middleware (node, fake fetch)
bun run size             # size-limit against the limits in package.json (peers external)
bun run example          # pack this repo and its siblings, install examples/start, vite build
```

## Layout

- `src/index.ts`: client entry, `"use client"` first line of `dist/index.js`.
- `src/start.ts`: `/start` entry. `@mirafive/sdk-server` is imported dynamically inside the
  middleware's `.server()` callback: apps import this entry from `src/start.ts`, which
  Start bundles for the browser too. Keep every sdk-server import there type-only or
  dynamic, and keep `process.env` reads inside the callback.
- `examples/start`: a living example, built by `bun run example` from packed tarballs
  (`examples/.packs`, ignored). Not in the npm package (`files: ["dist"]`).

## Local dependencies

`@mirafive/sdk-browser`, `@mirafive/sdk-server` and `@mirafive/sdk-react` are `file:../…`
devDependencies plus `overrides` entries until they are published; the peer ranges stay
`^0.5.0`. Build the siblings' `dist/` first if missing. Once 0.5.0 is on npm, switch the
devDependencies to `^0.5.0` and drop `overrides`; the example then installs from npm too.
A `file:` directory install mirrors the sibling's own `node_modules`, so tests dedupe
React in `vitest.config.ts` and the example installs tarballs instead.

## Rules

- API.md is the contract for this package's public surface. Do not add, rename or
  remove exports without changing API.md first. The provider prop is `websiteKey` because
  React reserves `key`.
- Thin by design: no transport, no evaluator, no router subscription. Pageviews come from
  sdk-browser's `pageviews()`, which the provider adds unless `plugins` holds one.
- The secret key is read only inside the middleware callback in `src/start.ts`. Check
  after a change that `examples/start/dist/client` holds no `mirafive-server` code.
- A response whose request read flags gets `Cache-Control: private, no-store` (FLAGS §5.3).
- `createStart()` runs its factory per request: clients live in a module-scope map keyed by
  key and host, never inside `miraMiddleware()`. A rejected start must not stay cached.
- The provider renders the `mirafive-flags` block from `bootstrap`; docs never pair it
  with `MiraFlagsScript`.
- Bundle size: client entry ≤ 1.2 kB, `/start` ≤ 1 kB (min + gzip, peers external). No
  runtime dependencies.
- `sideEffects: false` must stay true.
- Comments only for a non-obvious constraint, one or two lines.
- Do not run git write commands unless asked; the maintainer commits.
