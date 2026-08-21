# psatomas.com

Personal site for Tomás Araújo — protocol engineer. Built as a **Protocol
Lab**: an interactive technical environment (system map, live scoring/oracle
simulations) rather than a static resume-style portfolio, alongside a
straightforward projects section.

**Live:** [psatomas-com.psatomas.workers.dev](https://psatomas-com.psatomas.workers.dev)
(custom domain `psatomas.com` pending DNS migration to Cloudflare)

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS v4](https://tailwindcss.com) — tokens live in `src/app/globals.css` via `@theme`, no `tailwind.config.*`
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) via the [OpenNext](https://opennext.js.org/cloudflare) adapter — full SSR, not a static export
- GitHub Actions for CI (every PR + push to `main`) and deploy (manual trigger for now)

No UI/animation/diagramming libraries — every diagram and transition in the
Protocol Lab is hand-written inline SVG/CSS driven by React state.

## Development

```bash
npm run dev      # local dev server
npm run lint     # eslint
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
│   ├── page.tsx            # homepage: Hero + Protocol Lab
│   ├── layout.tsx          # root layout, nav, footer, metadata
│   ├── globals.css         # design tokens (dark-only graphite palette, one accent)
│   ├── projects/           # projects list + detail pages (static data, no CMS)
│   ├── opengraph-image.tsx # generated OG image (next/og)
│   └── robots.ts / sitemap.ts
├── components/
│   ├── navigation/nav.tsx
│   ├── sections/           # Hero, SystemMap, ProtocolLab, and the three
│   │                       # Lab experiments (EVM×SVM, Intent×MEV, Oracles)
│   └── ui/                 # small shared primitives (MonoLabel, Tag, StatusBadge, Container)
├── lib/
│   ├── projects.ts         # typed project data source
│   ├── site.ts             # site name/url/description
│   └── intent-simulation.ts / oracle-simulation.ts
│                           # pure, deterministic simulation logic, kept out of the components
└── types/index.ts
```

## The Protocol Lab

The homepage's Protocol Lab section holds three interactive experiments:

1. **EVM × SVM** — execution model comparison (state model, gas vs. compute
   units, sequential vs. parallel transaction execution)
2. **Intent Execution × MEV** — adjustable scoring policy over candidate
   execution routes; changing weights visibly changes which route wins
3. **Oracles** — the off-chain/on-chain boundary; submit price updates and
   watch the protocol accept or reject them based on freshness and validity

All three are self-contained, deterministic simulations (no timers, no
network calls) and are labeled `SIMULATION` where the underlying protocol
behavior isn't a real, deployed system — they model concepts from the
Execution Kernel Protocol project (see `/projects/execution-kernel-protocol`
on the site) without claiming to *be* it. That project lives in its own
separate repository, not this one.

## Deployment

`main` is protected by convention: feature branch → PR → CI (lint + build)
→ merge. Deploys to Cloudflare Workers are triggered manually from the
Actions tab (`Deploy to Cloudflare Workers`) rather than automatically on
merge, while the custom domain setup is still pending.

## Status

Shipped: homepage, design system, projects section, SEO basics
(sitemap/robots/OG image), CI, Cloudflare Workers deploy, Protocol Lab (all
three experiments). Not yet built: Research (blog), About page, and a
dedicated `/systems` route — the nav links to these render disabled rather
than pointing at pages that don't exist yet.
