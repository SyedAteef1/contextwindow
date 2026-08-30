import type { ReactNode } from "react";

/** A titled section. The heading is an anchor so clauses can be linked to. */
export function Clause({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-rule pt-8">
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

/** A table of what we hold and why, which reads better than a paragraph list. */
export function DataTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto rounded border border-rule">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-rule bg-surface">
            <th className="p-3 text-xs font-medium uppercase tracking-widest text-faint">What</th>
            <th className="p-3 text-xs font-medium uppercase tracking-widest text-faint">Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([what, why]) => (
            <tr key={what} className="border-b border-rule-soft last:border-b-0">
              <td className="p-3 align-top text-sm text-ink-soft">{what}</td>
              <td className="p-3 align-top text-sm text-muted">{why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageTitle({ title, updated }: { title: string; updated: string }) {
  return (
    <div className="mb-12 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">Legal</p>
      <h1 className="text-4xl font-semibold leading-tight tracking-tighter text-ink sm:text-5xl">
        {title}
      </h1>
      <p className="font-mono text-xs text-faint">Last updated {updated}</p>
    </div>
  );
}
