import type { JournalMetricsSummary } from '../types/api'

export function MetricsCoverage({ metrics }: { metrics: JournalMetricsSummary }) {
  return <section className="coverage-panel" aria-labelledby="coverage-title">
    <div className="coverage-intro"><span className="eyebrow">数据说明</span><h3 id="coverage-title">期刊指标覆盖情况</h3>
      <p>JIF 和 JCR Quartile 属于期刊层面的评价指标，与 PubMed metadata 分开提供。</p></div>
    <dl className="coverage-counts">
      <div><dt>有指标的期刊</dt><dd>{metrics.journals_with_metrics.toLocaleString()}</dd></div>
      <div><dt>无指标的期刊</dt><dd>{metrics.journals_without_metrics.toLocaleString()}</dd></div>
      <div><dt>有指标的文献</dt><dd>{metrics.articles_with_metrics.toLocaleString()}</dd></div>
      <div><dt>无指标的文献</dt><dd>{metrics.articles_without_metrics.toLocaleString()}</dd></div>
    </dl>
  </section>
}
