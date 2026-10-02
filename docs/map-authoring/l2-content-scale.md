# MAP content architecture at L2 scale

Can the current MAP content architecture carry the full L2 corpus? This
measures what the knowledge model costs today and with a synthetic L2 corpus,
before any L2 authoring. It decides whether storage must change first.

- **Baseline:** `main` at `b57bd16` (PR #198 merged). The corpus at baseline:
  - 354 content records;
  - L2 unauthored apart from the 66 dual-role concepts;
  - the `state` primitive present;
  - every L1 representation design resolved.
- **Decision: OPTIMIZE.** The architecture is sound for full L2; one targeted
  change should land before L2 authoring (section 11).
- **Value labels:** **measured** is observed directly; **derived** is
  computed from measured values; **estimated** is a judgment.

## 1. Dependency graph

```text
src/lib/map/data.ts ── mapKnowledge (taxonomy + all exposition, one literal)
  └─ src/lib/map/index.ts ── mapResolver = createMapResolver(mapKnowledge)
       │                     (validates the whole model at module evaluation)
       ├─ src/components/sections/map-preview.tsx  [server]  ← src/app/page.tsx "/" (force-dynamic)
       │     uses getMapL0Entries(mapResolver): 27 L0 labels and hrefs
       └─ src/app/api/map/content/[conceptId]/route.ts  [server] (force-static, dynamicParams=false)
             generateStaticParams over mapKnowledge.content; GET returns one exposition
scripts/generate-map-explorer-view.ts (npm run map:generate)
  └─ src/components/map/explorer-view.generated.json  (topology + hasContent, no text)
       └─ src/components/map/map-explorer.tsx  ["use client"]  ← src/app/map/page.tsx "/map" (force-dynamic)
src/components/map/{explorer-model,concept-exposition,exposition-models}.ts(x)
  └─ type-only imports from @/lib/map (erased); exposition is fetched from the API
```

| Consumer | Boundary | What it needs | What it receives |
|---|---|---|---|
| Homepage `MapPreview` | Server, per request | 27 L0 entries (topology) | The whole model, evaluated and validated |
| Content API | Server, prerendered | One concept's exposition | The whole model in its bundle; cache hits do not evaluate it (section 7) |
| `/map` explorer | Client, plus server render | Topology and `hasContent` | The generated view only |
| Exposition rendering | Client | One concept | One API response, fetched when the concept is opened |
| Authoring and build scripts | Node, development | Everything | `data.ts` |

**No exposition reaches the browser in JavaScript, HTML or RSC payloads
(measured):**

- no client chunk contains exposition text;
- `/`, `/map` and a deep-linked `/map?context=…` contain no exposition
  sentences in their HTML or RSC payload.

## 2. Corpus and source (measured, baseline)

| Artifact | Size |
|---|---|
| `src/lib/map/data.ts` | 1,371,810 B (340,702 B gzip) |
| Content records | 354 (27 L0, 327 L1) |
| Content as JSON | 885,329 B (260,468 B gzip) |
| Topology (concepts + placements) as JSON | 431,193 B (63,096 B gzip) |
| `content-registry.ts` | 8,803 B |
| `explorer-view.generated.json` | 299,706 B (37,677 B gzip) |
| Concepts / placements | 1,958 / 2,294 |

**Block usage:**

| Block | Count |
|---|---|
| paragraph | 1,519 |
| terms | 357 |
| distinction | 320 |
| heading | 316 |
| flow | 149 |
| comparison | 13 |
| tensions | 6 |
| cycle | 1 |

**Record size:**

| L1 record | Words | JSON bytes |
|---|---|---|
| Median | 223 | 1,584 |
| Mean | 281 | 2,417 |

## 3. Build output (measured, baseline)

All figures come from `npx opennextjs-cloudflare build` with a clean `.next`,
then `npx wrangler deploy --dry-run --outdir <dir>`.

| Output | Size |
|---|---|
| Worker upload (`Total Upload`, the size Cloudflare limits) | 13,519 KiB (gzip 3,121 KiB, reference only) |
| `server-functions/default/handler.mjs` | 9,004,943 B |
| Server chunk with the corpus: homepage page (`src_0ok3qcg`) | 1,159,966 B |
| Server chunk with the corpus: content route (`_0xo6d3z`) | 1,150,655 B |
| `/map` server chunk (generated view only) | 323,967 B |
| Client chunks (18 files) | 1,169,894 B (299,150 B gzip) |
| Largest client chunk (the topology view) | 324,006 B (45,300 B gzip) |
| Content-API prerender entries | 354 files, 1,027,002 B (median 1,926 B, max 18,489 B) |
| All prerender cache entries / static asset files | 370 / 42 |
| Build time | 32.9 s |

**The corpus is bundled twice:** every exposition sentence appears in the
Worker bundle twice, once per chunk in the table. The homepage chunk carries
it only because `MapPreview` imports `mapResolver` to list 27 domains. The
esbuild metafile (`handler.mjs.meta.json`) confirms both chunks among the
largest inputs.

## 4. Runtime and network (measured, `next start`, baseline)

Sizes are encoded (gzip from Next) and decoded. Content-API responses were
not compressed by `next start`; Cloudflare's edge compression was not
measured.

| Visit | Requests | Document | Scripts | MAP data |
|---|---|---|---|---|
| `/` | 26 | 23.9 KB / 137.1 KB | 159.8 KB / 538.5 KB | None; no content API, no topology chunk |
| `/map` | 23 | 8.3 KB / 75.1 KB | 197.3 KB / 832.0 KB | Topology chunk 45.3 KB gzip; no exposition until a concept is opened |
| `/map?context=finality-in-consensus` | 26 | 9.7 KB / 97.5 KB | as `/map` | Content API for the expanded L0 (14.8 KB) and the concept (2.3 KB) |
| `/map`, then open an L0, two L1s and another L1 | 30 | as `/map` | as `/map` | One API request per concept: 14.8, 1.5, 2.3, 1.2 KB |

- **Exposition loads lazily, one concept per request,** and is deduplicated
  per page by the client's request cache.
- **The JavaScript never duplicates it,** and the homepage downloads none.
- **`/map` never downloads the corpus.**
- **Prerendered content responses** carry `x-nextjs-cache: HIT` and
  `cache-control: s-maxage=31536000`.

## 5. Synthetic L2 corpus

`scripts/map-l2-synthetic.ts <low|expected|high> <other checkout>` adds one
record per l2-only concept (1,604) to the `data.ts` of a separate checkout:

- **Real shapes:** definition, paragraphs and structured blocks, valid under
  `validateMapKnowledge`. All 1,958 content routes prerendered.
- **Text:** drawn deterministically (seeded) from the existing corpus's own
  words, so compression behaves like exposition.
- **Safety:** it refuses to write into this repository.

| Scenario | Words (median) | Mean record JSON | Structured records | Mix |
|---|---|---|---|---|
| Low | 115 | 897 B | 174 (11%) | Definition and two short paragraphs; 10% one distinction |
| Expected | 210 | 1,574 B | 494 (31%) | Definition and three paragraphs, about the L1 median (the dual-role scale in [l2-analysis.md](l2-analysis.md#5-depth-contract)). Distinction 15%, flow 8%, comparison 3%, state 2%, cycle 1%, tensions 1% |
| High | 354 | 2,595 B | 896 (56%) | Four or five long paragraphs, above the L1 mean; half structured, a tenth with two structures |

## 6. Projections

Each scenario was built in a scratch worktree with the same commands as
section 3. All values are **measured** unless marked otherwise.

| Measure | Baseline | Low | Expected | High |
|---|---|---|---|---|
| `data.ts` | 1.37 MB | 3.01 MB | 4.23 MB | 6.10 MB |
| `data.ts` gzip | 341 KB | 825 KB | 1,218 KB | 1,810 KB |
| Worker upload | 13,519 KiB | 20,048 KiB | 22,178 KiB | 25,394 KiB |
| Worker upload, % of 64 MiB | 20.6% | 30.6% | 33.8% | 38.7% |
| Worker gzip (reference) | 3,121 KiB | 4,112 KiB | 4,863 KiB | 5,991 KiB |
| Server chunks carrying the corpus | 2 × 1.15 MB | 2 × 2.57 MB | 2 × 3.64 MB | 2 × 5.27 MB |
| Client chunks total | 1,169,894 B | 1,168,040 B | 1,168,040 B | 1,168,040 B |
| Client chunks with exposition | none | none | none | none |
| Generated view | 299,706 B | 297,852 B | 297,852 B | 297,852 B |
| Content-API prerender files | 354 | 1,958 | 1,958 | 1,958 |
| Content-API prerender bytes | 1.03 MB | 3.00 MB | 4.10 MB | 5.78 MB |
| Content-API response (median) | 1,926 B | 1,244 B | 1,901 B | 2,872 B |
| Asset files after deploy copies the cache (derived) | about 412 | about 2,016 | about 2,016 | about 2,016 |
| Worker startup CPU, local `wrangler check startup` | 33–39 ms | — | 34.6 ms | 34.7 ms |
| Cold load of the model: parse, evaluate, validate (Node, fresh process, median of 9) | 46.2 ms | 68.7 ms | 83.4 ms | 101.4 ms |
| of which parse and evaluate `data.ts` | 20.1 ms | 37.8 ms | 47.1 ms | 57.9 ms |
| of which validation (derived) | 26.1 ms | 30.9 ms | 36.3 ms | 43.5 ms |
| Heap after loading the model | 7.5 MB | 10.9 MB | 11.6 MB | 14.6 MB |
| OpenNext build time | 32.9 s | 35.4 s | 35.9 s | 36.2 s |
| `tsc --noEmit`, non-incremental | 22.2 s, 1.24 GB | — | 22.9 s, 1.29 GB | 22.7 s, 1.48 GB |

- **Content-proportional costs:** source size, the two server chunks, the
  prerendered content files, and the cold model load (wherever the model is
  evaluated).
- **Topology- or selection-proportional costs:** client JavaScript, `/map`,
  every HTML document, and each content response.

## 7. Homepage and content API, tested directly

**Homepage.** In a scratch worktree, `MapPreview` read its 27 entries from the
generated view instead of `mapResolver`. Measured:

| Corpus | Worker upload, current | Worker upload, topology-only homepage | Corpus copies in the Worker |
|---|---|---|---|
| Baseline | 13,519 KiB | 12,643 KiB (−876 KiB) | 1 |
| Expected | 22,178 KiB | 18,821 KiB (−3,357 KiB) | 1 |
| High (derived: high minus its homepage chunk plus the view, about 257 KiB) | 25,394 KiB | about 20,503 KiB | 1 |

- **What a homepage request evaluates.** Today a cold homepage request
  evaluates and validates the whole model: in a workerd local preview,
  `createMapResolver` alone took 26 ms at baseline; in Node the full cold
  load is 46 ms at baseline and 83 ms with the expected corpus.
- **The topology-only alternative.** Parsing the generated view takes 9.0 ms
  cold in Node. A 27-entry projection would cost next to nothing
  (estimated).
- **The budget.** This site runs on Workers Free (issue #44,
  `open-next.config.ts`), where CPU per request is 10 ms. Every new isolate's
  first homepage request already exceeds it, and with full L2 that overrun
  grows by about 1.8 to 2.2 times.

**Content API.** A temporary marker in the route module showed:

- With `next start`, two prerendered hits (`x-nextjs-cache: HIT`) and a
  homepage request evaluated the route module zero times.
- With `opennextjs-cloudflare preview` (workerd), content hits and `/map`
  logged no evaluation of the route module or the model, while `/` did.

The corpus in the content route is therefore **bundle size only**. Serving one
concept does not evaluate the corpus, so the API's runtime cost follows the
selected exposition, not the corpus. A further measured variant, with the
content route removed as if exposition were static files, gives a Worker of
10,637 KiB with the expected corpus.

## 8. Cloudflare

The deployment is OpenNext on Workers (`wrangler.jsonc`):

- **Assets:** `.open-next/assets`, with prerendered output served through
  the read-only static-assets incremental cache (`open-next.config.ts`).
- **Plan:** Workers Free, per issue #44 and the configuration comment.

Limits are from [developers.cloudflare.com/workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/),
fetched 2026-10-01.

| Limit | Free | Current | Expected L2 | High L2 | Kind |
|---|---|---|---|---|---|
| Worker size (uncompressed `Total Upload`; "There is no compressed size limit") | 64 MiB | 13.2 MiB | 21.7 MiB (18.4 MiB optimized) | 24.8 MiB (about 20.0 MiB optimized) | Hard; ample headroom |
| Worker startup (global scope) | 1 s | 33–39 ms local | 34.6 ms local | 34.7 ms local | Hard; unaffected, the corpus is not in global scope |
| Static asset files per version | 20,000 | about 412 | about 2,016 | about 2,016 | Hard; about 10% |
| Individual asset file | 25 MiB | 18.5 KB max | same | same | Hard; not a concern |
| Memory per isolate | 128 MB | heap 7.5 MB per loaded model | 11.6 MB | 14.6 MB | Hard; ample, even with both copies loaded |
| CPU time per HTTP request | 10 ms | Cold homepage already over it | about 1.8× worse | about 2.2× worse | **Performance and reliability: the only real concern** |

- **Hard limits:** none is threatened by full L2.
- **Performance:** the homepage's cold model load is the one cost that grows
  with the corpus on a request path.
- **Maintainability:** a 4–6 MB `data.ts` type-checks in the same time and
  diffs line by line. Its growth is a reviewability question, not a measured
  problem.

## 9. Options

- **A. Keep.** Within every hard limit, but the homepage keeps evaluating a
  corpus 3 to 4.5 times larger on cold requests, on a plan where CPU per
  request is the binding constraint. Technically workable, measurably worse.
- **B. Separate topology from exposition (targeted).** Give the one
  topology-only consumer, the homepage, a topology-only source, and keep
  exposition where it is. This removes the hot-path evaluation and one
  bundle copy, and changes nothing for authoring.
- **C. Generated per-concept files (static JSON assets).** Prerendered JSON
  files served by the asset layer. This removes the last bundle copy
  (measured: 10.6 MiB Worker) and Worker involvement in content requests. It
  adds a build step and about 1,600 more static files, and changes the content
  URL or routing. The benefit is real but not needed: the API already
  doesn't evaluate the corpus.
- **D. Domain or group content modules.** Splitting `data.ts` changes
  nothing at runtime, since the same chunks bundle the same records. It is a
  reviewability choice for the authoring pipeline, not a scaling fix.
- **E. External storage (D1, KV, R2).** Moves content out of git, so it loses
  static validation, fingerprints, diff validation and reproducible builds,
  and adds runtime reads and failure modes. Nothing measured justifies it.

| | A Keep | B Targeted | C Per-concept files | D Chunked source | E External |
|---|---|---|---|---|---|
| Browser payload | Unchanged, small | Unchanged | Unchanged | Unchanged | Unchanged |
| Worker bundle (expected) | 21.7 MiB | 18.4 MiB | 10.4 MiB | 21.7 MiB | Smallest |
| Cold homepage CPU | Grows with the corpus | Corpus-independent | Corpus-independent (with B) | Grows | Corpus-independent |
| Requests | One per concept | One per concept | One per concept | One per concept | One per concept, plus a storage read |
| Caching | Prerender cache | Prerender cache | Asset layer | Prerender cache | Must be built |
| Build complexity | None | One generated projection | A generation step | Low | High |
| Authoring complexity | None | None | None | Low | High |
| Static validation, type safety | Full | Full | Full at generation | Full | Weaker |
| Deterministic builds, local development | Yes | Yes | Yes | Yes | Needs data seeding |
| Failure modes | Cold CPU overrun | Generated-file drift (test-guarded) | Generated-file drift, routing | Same as A | Storage, consistency |
| Fit with the L2 pipeline (fingerprints, diffs, review) | Full | Full | Full | Needs path changes | Breaks repository ownership |

## 10. Authoring guarantees

B keeps every repository guarantee unchanged:

- deterministic validation, content fingerprints and stale-plan detection;
- diff validation and canonical ownership;
- registry consistency, representation validation and render verification;
- git reviewability and reproducible builds.

Exposition stays in `data.ts`. The new projection is generated, committed and
drift-tested, like `explorer-view.generated.json`, and changes only when L0
topology changes, never during L2 authoring. C would also keep them if its
files are generated at build. D would need diff and fingerprint tooling to
follow the new paths. E would lose most of them.

## 11. Decision: OPTIMIZE

**Evidence:**

- **Hard limits:** at the high projection, the Worker uses at most 38.7% of
  its size limit, startup is unchanged, and asset files reach about 10% of
  theirs.
- **Client:** payloads and `/map` don't depend on content, and every content
  response depends on one concept.
- **The one cost on a request path that grows with the corpus** is the
  homepage's evaluation and validation of the whole model. It needs 27
  labels. On Workers Free (10 ms CPU per request) the cold cost is already
  above budget (46 ms locally) and would reach about 83–101 ms.

**Thresholds** that would justify MIGRATE (option C or beyond), none met:

- the Worker upload passes 32 MiB, half the hard limit;
- startup passes 250 ms;
- static asset files pass 10,000;
- any request path must evaluate the corpus and import hygiene cannot remove
  it;
- production telemetry shows content-API requests exceeding CPU because of
  the bundle.

**Smallest change (B):**

1. **A topology-only L0 projection.** Add a generated file of the 27 L0
   entries (placement, concept, label), written by `npm run map:generate`
   and drift-tested like the explorer view.
2. **The homepage reads it.** `MapPreview` keeps its output and builds its
   entries from the projection instead of `mapResolver`.
3. **A guard test.** No module under `src/app` or `src/components` other than
   the content route imports `mapKnowledge` or `mapResolver`, so exposition
   stays off every hot path as L2 grows.

The content route stays as it is. Its bundle copy is the measured price of a
self-contained, prerendered, repository-owned API.

## 12. Effect on L2 orchestration

- **Content storage is unchanged:** `data.ts` and the registry, so plans,
  fingerprints, diff validation and the render check are unaffected.
- **A Worker budget check.** L2 PR verification records the dry-run Worker
  upload and fails above the 32 MiB threshold. Domain-completion verification
  repeats the cold-load measurement of section 6.
- **L2 diffs never touch the L0 projection,** and the generated explorer view
  still changes only by `hasContent` flips.

## 13. Uncertainty

- **Synthetic text.** Its words and structure mix are modelled, not
  authored, and real L2 may differ by tens of percent. The high scenario is
  set above the L1 mean to bound that.
- **Machine.** Timings are from this machine. Node and workerd share V8, but
  Cloudflare's CPUs differ. Relative changes are more reliable than absolute
  values.
- **Content-API module loading** was verified in `next start` and a local
  workerd preview, not in production.
- **Edge compression.** `next start` served content JSON uncompressed;
  Cloudflare's edge compression was not measured.
- **Plan and limits.** The plan is inferred from repository evidence, and the
  limits are as published on the fetch date.
- **Low scenario:** `tsc` and startup were not measured, being bounded by the
  expected and high runs.
- **Discarded:** a `next start` timing comparison of first content requests
  was inconclusive (it differs from production serving), and its numbers are
  not used.

## 14. Reproducing

```bash
# Baseline build, Worker size and bundle composition
npx opennextjs-cloudflare build
npx wrangler deploy --dry-run --outdir /tmp/dry        # "Total Upload" is the limited size
grep -c "A protocol property is a claim about the behavior" .open-next/server-functions/default/handler.mjs   # corpus copies
npx wrangler check startup --outfile /tmp/startup.cpuprofile

# A synthetic scenario in a separate checkout (never this repository)
git worktree add --detach /tmp/l2-measure HEAD
cp -a node_modules /tmp/l2-measure/                     # Turbopack rejects a symlinked node_modules
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/map-l2-synthetic.ts expected /tmp/l2-measure
cd /tmp/l2-measure && npm run map:generate && rm -rf .next .open-next && npx opennextjs-cloudflare build
npx wrangler deploy --dry-run --outdir /tmp/dry-expected
cd - && git worktree remove --force /tmp/l2-measure

# Cold load of the model: bundle it, then time `await import()` in fresh processes
node_modules/.bin/esbuild src/lib/map/index.ts --bundle --format=esm --platform=neutral --minify --outfile=/tmp/map-index.mjs
```

The client-chunk scan, the network capture (Playwright with
`request.sizes()`) and the module-evaluation markers are described in
sections 3, 4 and 7. Each uses only the production build and a temporary
worktree.
