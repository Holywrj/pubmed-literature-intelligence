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
      <div className="eyebrow"><span className="status-dot" /> LITERATURE EXPLORER</div>
      <h2 id="search-heading">A clearer view of the evidence.</h2>
      <p className="search-description">Search biomedical literature. Explore the patterns. Find your next research direction.</p>
      <form onSubmit={submit} className="search-form">
        <label htmlFor="literature-query" className="sr-only">Biomedical literature search</label>
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input id="literature-query" type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Search biomedical literature, e.g. lung cancer immunotherapy"
          maxLength={500} required disabled={loading} autoComplete="off" />
        <button className="primary-button" type="submit" disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search PubMed'}<span aria-hidden="true">↗</span>
        </button>
      </form>
      <div className="example-searches"><span>Try a topic</span>{examples.map(example => (
        <button type="button" key={example} disabled={loading} onClick={() => setQuery(example)}>{example}<span aria-hidden="true">↗</span></button>
      ))}</div>
      <div className="search-footnote">Live PubMed search <span aria-hidden="true">·</span> Deterministic analytics <span aria-hidden="true">·</span> AI review coming next</div>
    </section>
  )
}
