import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { JournalMetricsSummary } from '../types/api'
import { ChartEmpty, ChartPanel } from './ChartPanel'

export function QuartileChart({ metrics }: { metrics: JournalMetricsSummary }) {
  const data = Object.entries(metrics.quartile_distribution).map(([quartile, count]) => ({ quartile, count }))
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const unknownOnly = total > 0 && metrics.quartile_distribution.Unknown === total
  return <ChartPanel title="JCR Quartile Distribution" subtitle="Best journal quartile per analyzed article" tag="JOURNAL METRICS">
    {total ? <>
      {unknownOnly && <p className="metrics-notice">{metrics.articles_with_metrics === 0
        ? 'JCR metrics are unavailable for the current dataset. No values are fabricated.'
        : 'JCR quartiles are unavailable for the current dataset. Available JIF values are shown separately.'}</p>}
      <div className="chart-surface quartile-surface"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, left: -20, right: 8, bottom: 0 }} accessibilityLayer>
          <XAxis dataKey="quartile" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#637471' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#637471' }} />
          <Tooltip cursor={{ fill: '#f2f6f4' }} />
          <Bar dataKey="count" name="Articles" fill={unknownOnly ? '#98aaa4' : '#43988b'} radius={[4, 4, 0, 0]} maxBarSize={45} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer></div>
      <p className="quartile-counts">{data.map(item => <span key={item.quartile}>{item.quartile} <strong>{item.count}</strong></span>)}</p>
    </> : <ChartEmpty>No articles to summarize by quartile.</ChartEmpty>}
  </ChartPanel>
}
