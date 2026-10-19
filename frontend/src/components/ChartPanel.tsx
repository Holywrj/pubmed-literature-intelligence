import { useId } from 'react'
import type { ReactNode } from 'react'

export function ChartPanel({ title, subtitle, tag, children }: { title: string; subtitle: string; tag?: string; children: ReactNode }) {
  const id = useId()
  return <section className="panel" aria-labelledby={id}>
    <div className="panel-header"><div><h3 id={id}>{title}</h3><p>{subtitle}</p></div>{tag && <span className="panel-tag">{tag}</span>}</div>
    {children}
  </section>
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return <div className="chart-empty"><span aria-hidden="true">—</span><p>{children}</p></div>
}
