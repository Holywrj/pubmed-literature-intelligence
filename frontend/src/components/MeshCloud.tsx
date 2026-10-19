import type { MeshTermFrequency } from '../types/api'
import { ChartEmpty, ChartPanel } from './ChartPanel'

export function MeshCloud({ terms }: { terms: MeshTermFrequency[] }) {
  const values = terms.slice(0, 30)
  const min = Math.min(...values.map(item => item.frequency))
  const max = Math.max(...values.map(item => item.frequency))
  return <ChartPanel title="MeSH 研究热点" subtitle="当前分析文献中的高频 MeSH 主题词" tag="MeSH">
    {values.length ? <ul className="mesh-cloud">{values.map(item => {
      const weight = max === min ? 0.5 : (Math.log1p(item.frequency) - Math.log1p(min)) / (Math.log1p(max) - Math.log1p(min))
      return <li key={item.term} style={{ fontSize: `${0.78 + weight * 1.32}rem` }} title={`${item.term}：${item.frequency} 次`}>
        <span>{item.term}</span><small>{item.frequency}</small>
      </li>
    })}</ul> : <ChartEmpty>暂无 MeSH 主题词。部分近期文献可能尚未完成索引。</ChartEmpty>}
    {values.length > 0 && <p className="panel-footnote">字号按词频对数缩放，字号越大表示在当前分析样本中出现越频繁。</p>}
  </ChartPanel>
}
