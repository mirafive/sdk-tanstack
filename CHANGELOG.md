# Changelog

## 1.0.0 — 2026-09-27

First release on the v1 protocol, written from scratch over `@mirafive/sdk-react`,
`@mirafive/sdk-browser` and `@mirafive/sdk-server` 1.0.

- Client entry (`"use client"`): `<MiraProvider websiteKey>` creates the browser client
  once, adds `pageviews()` unless `plugins` has one, renders the flag `bootstrap` as the
  `mirafive-flags` block and passes it to the hooks; warns about a missing key or a changed
  plugin set; re-exports `useMira`, `useFlag`, `useFlagConfig` and `useTrackOnMount`.
- `/start`: `miraMiddleware({ key?, host?, waitUntil? })` puts `mira` and `flagsFor` on
  `context` (opt-out from `Sec-GPC`/`DNT`), shares one client pair per key and host across
  calls (`createStart()` calls its factory per request), flushes once the response is
  ready (through `waitUntil` when given) and marks flag-reading responses
  `private, no-store`; `<MiraFlagsScript>`. The server SDK is loaded lazily and never
  reaches the browser bundle.
- `examples/start`, built with `vite build` against packed tarballs.
