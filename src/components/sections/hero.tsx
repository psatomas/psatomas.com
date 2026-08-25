import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { SystemMap } from "@/components/sections/system-map";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-16 px-6 py-20 md:grid-cols-[3fr_2fr] md:items-center md:py-28">
      <div className="flex flex-col gap-8">
        <MonoLabel>PROTOCOL ENGINEERING / 2026</MonoLabel>

        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          BUILDING SYSTEMS
          <br />
          FOR DECENTRALIZED
          <br />
          EXECUTION.
        </h1>

        <p className="max-w-md text-lg text-muted">
          I build and investigate blockchain protocols, execution
          environments, and distributed infrastructure.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href="#lab"
            className="border border-accent bg-accent px-5 py-2.5 font-mono text-xs tracking-[0.1em] text-accent-foreground transition-colors hover:bg-transparent hover:text-accent"
          >
            ENTER LAB
          </a>
          <Link
            href="/projects"
            className="border border-border px-5 py-2.5 font-mono text-xs tracking-[0.1em] text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            VIEW SYSTEMS
          </Link>
        </div>

        <MonoLabel className="text-dim">
          EVM · SOLIDITY · PROTOCOL DESIGN · DISTRIBUTED SYSTEMS
        </MonoLabel>
      </div>

      <div className="flex justify-center md:justify-end">
        <SystemMap />
      </div>
    </section>
  );
}
