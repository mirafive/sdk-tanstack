# Changelog

## 0.5.0 — unreleased

First release on the v1 protocol, written from scratch over `@mirafive/sdk-react`,
`@mirafive/sdk-browser` and `@mirafive/sdk-server` 0.5.

- Client entry (`"use client"`, 0.48 kB): `<MiraProvider websiteKey>` creates the browser
  client once, adds `pageviews()` unless `plugins` has one, and passes a flag `bootstrap`
  to the hooks; re-exports `useMira`, `useFlag`, `useFlagConfig` and `useTrackOnMount`.
- `/start` (0.69 kB): `miraMiddleware({ key?, host?, waitUntil? })` puts `mira` and
  `flagsFor` on `context` (opt-out from `Sec-GPC`/`DNT`), flushes once the response is
  ready (through `waitUntil` when given) and marks flag-reading responses
  `private, no-store`; `<MiraFlagsScript>`. The server SDK is loaded lazily and never
  reaches the browser bundle.
- `examples/start`, built with `vite build` against packed tarballs.
