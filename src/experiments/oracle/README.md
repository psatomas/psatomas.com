# Oracle freshness and fallback

Diagnosis checked before editing on 2026-09-17: the previous policy used
15s FRESH / 60s maximum age, with a 30s service refresh window. Expired
entries were ignored on upstream error and the response became UNAVAILABLE.
The client comment was obsolete: component.tsx already called the real API.

Two spaced keyless ETH/USD requests returned HTTP 200 with
`last_updated_at=1789662460`; local receipt times were 1789662606 and
1789662639 (146s and 179s old). This supports the diagnosed multi-minute
behavior but is a small sample, not a measured long-term SLA.
CoinGecko documents using `last_updated_at` to assess freshness:
https://docs.coingecko.com/reference/simple-price
Keyless limitations: https://docs.coingecko.com/docs/keyless-public-api

Policy: FRESH through 180s, AGING above 180s through 300s, STALE above
300s. Three minutes accommodates these empirical observed response ages;
the next two minutes explicitly signal aging rather than extending FRESH.
Five minutes signals delayed updates. These are experiment tolerances,
not suitability guarantees for trading or protocol execution.

The 30s service cache window is unchanged and independent of observation
age. Successful observations are retained for one hour in KV or memory,
so outages can display last-known data (STALE after five minutes).
Retention is not a usability window. Failures do not rewrite cachedAt,
observedAt, or storage expiry. At response delivery, after awaiting refresh
and coalescing, the service also checks the original successful fetch time
plus one hour. An observation that expires during refresh is discarded,
with no fetchedAt returned, and failure is UNAVAILABLE. This lifetime limits
retained cache delivery, not the age of a newly fetched provider observation.
After eviction, failure is UNAVAILABLE.
Existing KV entries keep their old expiry until the next successful refresh.

Refresh success replaces the cached value. A thrown failure or null result
uses an existing source+asset observation and reports delivery=FALLBACK,
refreshError, and the original fetchedAt. Every response is evaluated at
refresh completion time. CACHE and UPSTREAM identify the other delivery
paths. retrievedAt remains evaluation time, not evidence of a new fetch.
The UI shows original OBSERVED AT and LAST FETCHED, advancing OBSERVATION
AGE/FRESHNESS between polls (even while paused). Client aging starts at the
server-evaluated age and adds performance.now() elapsed time since receipt;
it does not subtract observedAt from the browser wall clock. Server timestamps
remain unchanged. The UI labels delivery health OK / DEGRADED / ERROR (and
STALE for old non-fallback readings) and receipt time LAST API RESPONSE.
DEGRADED derives from delivery=FALLBACK, independently of whether an error
string is empty. The public failure message is always "The source could not provide
an observation." for thrown failures or missing upstream observations;
arbitrary exception text is never serialized. Client request failures also
show fixed copy rather than exception text. Freshness and transport health
are independent:
a recent fallback can be FRESH in age while visibly DEGRADED in delivery.

Same-key concurrent refreshes coalesce within an isolate. Failed refreshes
back off on demand for 30s, then 60s, remaining capped at 60s; there are no
automatic retries. Success clears backoff; the next failure starts at 30s
again. Backoff metadata is isolate-local
and bounded to 256 keys. KV sharing is eventually consistent, not a global
rate limiter; cold isolates can still issue overlapping upstream requests.
No browser CoinGecko calls or new polling were added.

## Local verification (2026-09-17)

Chromium against the corrected production build received a real ETH/USD
observations at 161.952s and 170.671s age: FRESH / OK, delivery UPSTREAM. An immediate
second request was CACHE / OK with identical observedAt and fetchedAt.
Controlled adapter failures ran through the actual service/cache and were
injected at the browser API boundary; these checks made no CoinGecko calls.

With browser Date.now() shifted by zero, +24 hours, and -24 hours, the same
fallback advanced FRESH → AGING → STALE using simulated monotonic elapsed
time while paused, retaining both original timestamps and DEGRADED status.
An empty error string still displayed DEGRADED. Expiry during failed refresh
returned UNAVAILABLE / ERROR, with no observation or fetchedAt. Recovery
returned UPSTREAM / OK, and the service's subsequent failure retried after
30s. No console errors, page errors, or browser CoinGecko requests occurred.

ESLint, TypeScript, the full suite (94 tests), production build, and
`git diff --check` passed. No EVM or Intent implementation files changed.
