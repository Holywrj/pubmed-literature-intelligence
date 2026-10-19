import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmpty, ChartPanel } from './ChartPanel'

export function PublicationTrendChart({ distribution }: { distribution: Record<string, number> }) {
  const data = Object.entries(distribution).map(([year, count]) => ({ year: Number(year), count })).sort((a, b) => a.year - b.year)
  return <ChartPanel title="发表趋势" subtitle="当前分析文献的发表年份" tag="按年">
    {data.length ? <>
      <div className="chart-surface">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 15, right: 12, bottom: 0, left: -15 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 4" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} minTickGap={22} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
            <Tooltip labelFormatter={label => `发表年份：${label}`} />
            <Area type="linear" dataKey="count" name="文献" stroke="var(--color-primary)" strokeWidth={2.5} fill="var(--color-chart-fill)" isAnimationActive={false} dot={data.length === 1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data"><summary>查看各年份文献数量</summary><ul>{data.map(item => <li key={item.year}>{item.year}：{item.count} 篇</li>)}</ul></details>
    </> : <ChartEmpty>暂无可用的发表年份数据。</ChartEmpty>}
  </ChartPanel>
}
