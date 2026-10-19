import { useState } from 'react'
import type { FormEvent } from 'react'

const examples = ['lung cancer immunotherapy', 'EGFR lung cancer', 'CAR-T therapy']

export function SearchBar({ loading, onSearch }: { loading: boolean; onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (query.trim() && !loading) onSearch(query.trim())
  }
  return (
    <section className="search-section" aria-labelledby="search-heading">
      <div className="eyebrow"><span className="status-dot" /> 文献检索</div>
      <h2 id="search-heading">快速了解研究领域的文献全景</h2>
      <p className="search-description">检索 PubMed 生物医学文献，分析研究趋势、热点主题与核心文献。</p>
      <form onSubmit={submit} className="search-form">
        <label htmlFor="literature-query" className="sr-only">生物医学文献检索</label>
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input id="literature-query" type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="输入研究主题，例如：lung cancer immunotherapy"
          maxLength={500} required disabled={loading} autoComplete="off" />
        <button className="primary-button" type="submit" disabled={loading || !query.trim()}>
          {loading ? '检索中…' : '搜索 PubMed'}<span aria-hidden="true">↗</span>
        </button>
      </form>
      <div className="example-searches"><span>试试这些主题</span>{examples.map(example => (
        <button type="button" key={example} disabled={loading} onClick={() => setQuery(example)}>{example}<span aria-hidden="true">↗</span></button>
      ))}</div>
      <div className="search-footnote">实时 PubMed 检索 <span aria-hidden="true">·</span> 确定性统计分析 <span aria-hidden="true">·</span> AI 研究综述</div>
    </section>
  )
}
