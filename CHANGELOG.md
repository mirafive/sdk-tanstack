# Changelog

## Unreleased

- **Breaking:** feature flags and A/B experiments are removed. `<MiraProvider>` no longer
  takes `bootstrap` and renders no `mirafive-flags` block, `useFlag` and `useFlagConfig`
  are no longer re-exported, and the type `FlagBootstrap` is gone. In `/start`,
  `context.flagsFor`, `<MiraFlagsScript>` and the types `FlagUnit` and `UserFlags` are
  gone, and responses no longer get `Cache-Control: private, no-store`. `context.mira`
  stays.
- Consent: statistics is the only purpose. The `experiments` and `targeting` purposes are
  gone. `useMira().consent({ experiments, targeting })` from an existing site still
  works; sdk-browser accepts and ignores the keys.

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
