// Shared "NN / TITLE" + subtitle header used above (or, for a locked
// single-object section, inside) a system detail page's numbered
// sections — established by /systems/exekpro, reused by every bespoke
// system detail page since the shape (index label + larger title) is a
// page-structure concern, not specific to any one system's content.
//
// Deliberately not <MonoLabel className="text-accent">: MonoLabel's own
// base classes bake in text-muted after any caller-supplied className in
// the generated stylesheet, so a text-accent override loses regardless
// of class order in that className string — the same pre-existing issue
// already affects /lab's "01" index badges. Reproducing MonoLabel's own
// classes directly here (rather than editing that shared component,
// which would also change Lab) keeps the workaround in exactly one
// place instead of duplicating it per system page.
export function SectionHeader({ index, subtitle }: { index: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
        {index}
      </span>
      <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
        {subtitle}
      </span>
    </div>
  );
}
