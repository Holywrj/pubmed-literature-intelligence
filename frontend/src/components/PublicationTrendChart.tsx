import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartEmpty, ChartPanel } from './ChartPanel'

export function PublicationTrendChart({ distribution }: { distribution: Record<string, number> }) {
  const data = Object.entries(distribution).map(([year, count]) => ({ year: Number(year), count })).sort((a, b) => a.year - b.year)
  return <ChartPanel title="Publication Trend" subtitle="Publication years of analyzed articles" tag="YEARLY">
    {data.length ? <>
      <div className="chart-surface">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 15, right: 12, bottom: 0, left: -15 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#e7ecea" strokeDasharray="3 4" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} minTickGap={22} tick={{ fontSize: 11, fill: '#637471' }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#637471' }} />
            <Tooltip labelFormatter={label => `Publication year: ${label}`} />
            <Area type="linear" dataKey="count" name="Articles" stroke="#16766b" strokeWidth={2.5} fill="#dceee7" isAnimationActive={false} dot={data.length === 1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data"><summary>View publication counts</summary><ul>{data.map(item => <li key={item.year}>{item.year}: {item.count} articles</li>)}</ul></details>
    </> : <ChartEmpty>No publication-year data is available for these articles.</ChartEmpty>}
  </ChartPanel>
}
