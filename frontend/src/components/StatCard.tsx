export function StatCard({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return <article className={`stat-card${accent ? ' stat-accent' : ''}`}>
    <h3>{label}</h3><p className="stat-value">{value}</p><p className="stat-note">{note}</p>
  </article>
}
