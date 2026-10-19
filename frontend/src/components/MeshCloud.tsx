import type { MeshTermFrequency } from '../types/api'
import { ChartEmpty, ChartPanel } from './ChartPanel'

export function MeshCloud({ terms }: { terms: MeshTermFrequency[] }) {
  const values = terms.slice(0, 30)
  const min = Math.min(...values.map(item => item.frequency))
  const max = Math.max(...values.map(item => item.frequency))
  return <ChartPanel title="Research Hotspots" subtitle="Top MeSH terms in analyzed literature" tag="MESH">
    {values.length ? <ul className="mesh-cloud">{values.map(item => {
      const weight = max === min ? 0.5 : (item.frequency - min) / (max - min)
      return <li key={item.term} style={{ fontSize: `${0.85 + weight * 0.95}rem` }} title={`${item.term}: ${item.frequency} occurrences`}>
        <span>{item.term}</span><small>{item.frequency}</small>
      </li>
    })}</ul> : <ChartEmpty>No MeSH terms are available. Some recent articles have not yet been indexed.</ChartEmpty>}
    {values.length > 0 && <p className="panel-footnote">Larger terms appear more frequently. Counts describe the analyzed sample.</p>}
  </ChartPanel>
}
