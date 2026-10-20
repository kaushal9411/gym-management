import * as React from 'react';

/** Numbered step card from the design: round number badge, heading, helper line, then content. */
export function StepCard({ n, title, sub, children, id }: { n: number; title: string; sub?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id ?? `step-${n}`}-h`} className="rounded-2xl border bg-card p-4 shadow-xs sm:px-5 sm:py-[18px]">
      <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3.5">
        <div aria-hidden className="grid size-[34px] place-items-center rounded-full bg-primary/12 text-base font-extrabold text-primary">
          {n}
        </div>
        <div className="min-w-0">
          <h2 id={`${id ?? `step-${n}`}-h`} className="text-lg font-bold leading-tight">
            {title}
          </h2>
          {sub ? <p className="mb-3 mt-0.5 text-[13px] text-muted-foreground">{sub}</p> : null}
          {children}
        </div>
      </div>
    </section>
  );
}
