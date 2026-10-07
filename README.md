# `next: { revalidate: false }` is not cached under `dynamic = 'force-dynamic'`

The docs describe `fetch(url, { next: { revalidate: false } })` as "cache indefinitely", equivalent to `revalidate: Infinity`. When the route segment sets `export const dynamic = 'force-dynamic'`, such a fetch is never cached: every request goes to the network and the dev log reports `Cache skipped reason: (revalidate: 0)`. The same fetch with a numeric revalidate (here one year, `31_536_000`) is cached as expected.

The cause looks like the truthiness check in `packages/next/src/server/lib/patch-fetch.ts`:

```ts
const noFetchConfigAndForceDynamic =
  !pageFetchCacheMode &&
  !currentFetchCacheConfig &&
  !currentFetchRevalidate &&
  workStore.forceDynamic
```

`!currentFetchRevalidate` is `true` for an explicit `revalidate: false`, so the fetch is treated as having no cache config, and the next branch sets `currentFetchRevalidate = 0`.

## Steps

```sh
npm install
npm run dev
# in another shell, after the first compile:
curl -s localhost:3000/
curl -s localhost:3000/
curl -s localhost:3000/
```

`app/layout.tsx` sets `export const dynamic = 'force-dynamic'`. `app/page.tsx` fetches `https://httpbin.org/uuid` twice and renders both UUIDs:

- `forever`: `{ next: { revalidate: false } }`
- `oneYear`: `{ next: { revalidate: 31_536_000 } }` (URL `https://httpbin.org/uuid?y` so the cache keys differ)

The same happens with `npm run build && npm start`.

## Expected

Both fetches are cached. `forever` and `oneYear` stay the same across requests.

## Actual

`oneYear` stays the same, `forever` changes on every request.

Dev log (`next dev`, 16.5.0-canary.1; the first request is the compile warm-up):

```
 GET / 200 in 1806ms (next.js: 81ms, application-code: 1725ms)
 │ GET https://httpbin.org/uuid 200 in 632ms (cache skip)
 │ │ Cache skipped reason: (revalidate: 0)
 │ GET https://httpbin.org/uuid?y 200 in 1043ms (cache skip)
 │ │ Cache skipped reason: (cache-control: no-cache (hard refresh))
 GET / 200 in 503ms (next.js: 0.8ms, application-code: 502ms)
 │ GET https://httpbin.org/uuid 200 in 476ms (cache skip)
 │ │ Cache skipped reason: (revalidate: 0)
 │ GET https://httpbin.org/uuid?y 200 in 2ms (cache hit)
 GET / 200 in 130ms (next.js: 0.9ms, application-code: 129ms)
 │ GET https://httpbin.org/uuid 200 in 111ms (cache skip)
 │ │ Cache skipped reason: (revalidate: 0)
 │ GET https://httpbin.org/uuid?y 200 in 1ms (cache hit)
```

Production (`next build && next start`, 16.5.0-canary.1), three requests:

```
{ "forever": "a466c974-a7a5-44cc-b7b3-9d0f864f8e90", "oneYear": "3c61da00-c94c-456a-8c95-13b926b502d8" }
{ "forever": "23dac458-945d-411b-b5ba-7557f6177e72", "oneYear": "3c61da00-c94c-456a-8c95-13b926b502d8" }
{ "forever": "f8ceec88-abc7-42d0-9a2c-b41661cc94cb", "oneYear": "3c61da00-c94c-456a-8c95-13b926b502d8" }
```

## Control

Remove `export const dynamic = 'force-dynamic'` from `app/layout.tsx` and add `await connection()` (from `next/server`) at the top of `Page` so the route stays dynamic (`ƒ /` in the build output). Now `revalidate: false` is cached in both `next dev` (log shows `cache hit` from request 2) and `next start` (`forever` stays the same across requests). So the difference comes from `force-dynamic`, not from the endpoint or the fetch itself.

## Versions tested

- `next@16.5.0-canary.1`: reproduces in `next dev` and `next start`
- `next@16.2.6`: reproduces in `next dev` (same log lines)

React 19.3.0, TypeScript 5.9.3, Node 24.3.0, macOS arm64.
