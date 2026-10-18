import type { JournalMetricsSummary } from '../types/api'

export function MetricsCoverage({ metrics }: { metrics: JournalMetricsSummary }) {
  return <section className="coverage-panel" aria-labelledby="coverage-title">
    <div className="coverage-intro"><span className="eyebrow">DATA TRANSPARENCY</span><h3 id="coverage-title">Metrics Coverage</h3>
      <p>Journal Impact Factor and JCR Quartile are journal-level metrics and are separate from PubMed metadata.</p></div>
    <dl className="coverage-counts">
      <div><dt>Journals with metrics</dt><dd>{metrics.journals_with_metrics.toLocaleString()}</dd></div>
      <div><dt>Journals without metrics</dt><dd>{metrics.journals_without_metrics.toLocaleString()}</dd></div>
      <div><dt>Articles with metrics</dt><dd>{metrics.articles_with_metrics.toLocaleString()}</dd></div>
      <div><dt>Articles without metrics</dt><dd>{metrics.articles_without_metrics.toLocaleString()}</dd></div>
    </dl>
  </section>
}
