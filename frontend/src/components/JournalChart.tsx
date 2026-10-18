import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { JournalCount } from '../types/api'
import { ChartEmpty, ChartPanel } from './ChartPanel'

export function JournalChart({ journals }: { journals: JournalCount[] }) {
  const data = journals.slice(0, 10).map((item, index) => ({ ...item, position: index + 1 }))
  return <ChartPanel title="Top Journals" subtitle="Leading journals in the analyzed sample" tag="TOP 10">
    {data.length ? <>
      <div className="journal-chart" style={{ height: Math.max(210, data.length * 39) }}>
        <ol className="journal-labels">{data.map(item => <li key={item.journal} title={item.journal}><span>{item.journal}</span></li>)}</ol>
        <div className="journal-bars"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 26, left: 0, bottom: 0 }} accessibilityLayer>
            <XAxis type="number" hide domain={[0, 'dataMax']} allowDecimals={false} />
            <YAxis type="category" dataKey="journal" hide />
            <Tooltip cursor={{ fill: '#f2f6f4' }} />
            <Bar dataKey="count" name="Articles" fill="#43988b" radius={[0, 4, 4, 0]} barSize={11} isAnimationActive={false} label={{ position: 'right', fontSize: 11, fill: '#4f6560' }} />
          </BarChart>
        </ResponsiveContainer></div>
      </div>
      <details className="chart-data"><summary>View journal counts</summary><ul>{data.map(item => <li key={item.journal}>{item.journal}: {item.count}</li>)}</ul></details>
    </> : <ChartEmpty>No journal names are available for these articles.</ChartEmpty>}
  </ChartPanel>
}
