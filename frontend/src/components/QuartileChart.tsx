import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { JournalMetricsSummary } from '../types/api'
import { ChartEmpty, ChartPanel } from './ChartPanel'

export function QuartileChart({ metrics }: { metrics: JournalMetricsSummary }) {
  const data = Object.entries(metrics.quartile_distribution).map(([quartile, count]) => ({
    quartile: quartile === 'Unknown' ? '暂无' : quartile,
    count,
  }))
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const unknownOnly = total > 0 && metrics.quartile_distribution.Unknown === total
  return <ChartPanel title="JCR Quartile 分布" subtitle="当前分析文献对应期刊的最佳分区" tag="期刊指标">
    {total ? <>
      {unknownOnly && <p className="metrics-notice">{metrics.articles_with_metrics === 0
        ? '当前数据集暂无 JIF / JCR Quartile 数据，页面不会虚构任何数值。'
        : '当前数据集暂无 JCR Quartile 数据，已有 JIF 数值将在其他位置单独展示。'}</p>}
      <div className="chart-surface quartile-surface"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, left: -20, right: 8, bottom: 0 }} accessibilityLayer>
          <XAxis dataKey="quartile" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
          <Tooltip cursor={{ fill: 'var(--color-surface-muted)' }} />
          <Bar dataKey="count" name="文献" radius={[4, 4, 0, 0]} maxBarSize={45} isAnimationActive={false}>
            {data.map(item => <Cell key={item.quartile} fill={item.quartile === '暂无' ? 'var(--color-chart-unknown)' : 'var(--color-primary)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer></div>
      <p className="quartile-counts">{data.map(item => <span key={item.quartile}>{item.quartile} <strong>{item.count}</strong></span>)}</p>
    </> : <ChartEmpty>暂无可用于统计 JCR Quartile 的文献。</ChartEmpty>}
  </ChartPanel>
}
