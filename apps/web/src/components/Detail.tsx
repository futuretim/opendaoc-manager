import type { ReactNode } from "react";

export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </section>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="break-words text-right">{value === "" || value == null ? "—" : value}</dd>
    </div>
  );
}

export function StatGrid({ stats }: { stats: [string, number][] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2">
          <span className="text-slate-500">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
