import Link from "next/link";

const navItems: Array<
  | { label: string; href: string; external?: boolean }
  | { label: string; disabled: true }
> = [
  { label: "LAB", href: "#lab" },
  { label: "SYSTEMS", href: "/projects" },
  { label: "RESEARCH", disabled: true },
  { label: "ABOUT", disabled: true },
  { label: "GITHUB", href: "https://github.com/psatomas", external: true },
];

export function Nav() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="font-mono text-xs tracking-[0.14em] text-foreground hover:text-accent transition-colors"
        >
          TOMÁS ARAÚJO
        </Link>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-8">
          {navItems.map((item) =>
            "disabled" in item ? (
              <span
                key={item.label}
                className="font-mono text-xs tracking-[0.14em] text-dim cursor-default"
                title="Coming soon"
              >
                {item.label}
              </span>
            ) : (
              <a
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="font-mono text-xs tracking-[0.14em] text-muted hover:text-accent transition-colors"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
