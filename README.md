# psatomas.com

Personal site for Tomás Araújo — protocol engineer. Built as a **Protocol
Lab**: an interactive technical environment (system map, live scoring/oracle
data) rather than a static resume-style portfolio, alongside a
straightforward projects section.

**Live:** [psatomas.com](https://psatomas.com)

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS v4](https://tailwindcss.com) — tokens live in `src/app/globals.css` via `@theme`, no `tailwind.config.*`
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) via the [OpenNext](https://opennext.js.org/cloudflare) adapter — full SSR, not a static export
- GitHub Actions for CI (lint + test + build, on every PR + push to `main`) and deploy (manual trigger for now)

No UI/animation/diagramming libraries — every diagram and transition in the
Protocol Lab is hand-written inline SVG/CSS driven by React state.

## Development

```bash
npm run dev      # local dev server
npm run lint     # eslint
npm run test     # node's built-in test runner — Oracle domain/service/adapter tests
npm run build    # production build (also runs the TypeScript check)
```

```bash
npm run preview  # build with OpenNext and run it locally under workerd —
                  # the actual Cloudflare Workers runtime, not just next dev
npm run deploy    # build and deploy to Cloudflare Workers
```

## Project structure

```
src/
├── app/
│   ├── page.tsx              # homepage: Hero + Protocol Lab
│   ├── layout.tsx             # root layout, nav, footer, metadata
│   ├── globals.css            # design tokens (dark-only graphite palette, one accent)
│   ├── api/oracle/route.ts    # Oracle API — thin, composes the service + an adapter
│   ├── projects/              # projects list + detail pages (static data, no CMS)
│   ├── opengraph-image.tsx    # generated OG image (next/og)
│   └── robots.ts / sitemap.ts
├── components/
│   ├── navigation/nav.tsx
│   ├── sections/              # Hero, SystemMap — homepage content, not experiments
│   ├── lab/                   # shared Protocol Lab shell + primitives (FlowBox,
│   │                          # StatusBadge, the ProtocolLab shell itself)
│   └── ui/                    # generic shared primitives (MonoLabel, Tag, Container)
├── experiments/            # each Lab experiment owns its directory — no
│   │                       # experiment imports another or the shell
│   ├── evm/                # static, deterministic execution-model deep dive
│   ├── intent-mev/         # deterministic scoring simulation
│   └── oracle/             # domain model, service, CoinGecko adapter, API
│       │                   # contract/client, and the live-data UI
│       ├── domain/ · service/ · api/
│       └── component.tsx
├── lib/
│   ├── projects.ts             # typed project data source
│   ├── site.ts                 # site name/url/description
│   └── experiments/registry.ts # the only file that knows about all 3 experiments
└── types/index.ts
```

## The Protocol Lab

The homepage's Protocol Lab section holds three interactive experiments,
each an independently bounded module under `src/experiments/` — adding,
removing, or replacing one never touches the shell or the others:

1. **EVM** — an execution-model deep dive (state/storage model, gas, message
   calls, transaction-level atomicity). A static, deterministic exploration
   of the EVM itself, not a comparison.
2. **Intent Execution × MEV** — adjustable scoring policy over candidate
   execution routes; changing weights visibly changes which route wins. A
   deterministic, client-side simulation.
3. **Oracle** — a real, live pipeline: CoinGecko's public API → an Oracle
   adapter → an Oracle service → an API route → a polling UI showing the
   observed value, its freshness, and the latency between when it was
   observed and when this client received it. Not a simulation — the
   domain/service/API layers are genuinely exercised end to end, including
   real provider-failure handling (rate limits, timeouts, malformed
   responses all surface honestly rather than being papered over).

## Deployment

`main` is protected by convention: feature branch → PR → CI (lint + test +
build) → merge. Deploys to Cloudflare Workers are triggered manually from
the Actions tab (`Deploy to Cloudflare Workers`) rather than automatically
on merge.

## Status

Shipped: homepage, design system, projects section, SEO basics
(sitemap/robots/OG image), CI, Cloudflare Workers deploy, Protocol Lab (all
three experiments, Oracle now backed by live external data). Not yet
built: Research (blog), About page, a dedicated `/systems` route — the nav
links to these render disabled rather than pointing at pages that don't
exist yet — and an on-chain comparison for the Oracle experiment.
